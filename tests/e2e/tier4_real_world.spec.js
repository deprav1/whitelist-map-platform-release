// @ts-check
const { test, expect, devices } = require('@playwright/test');

test.describe('Tier 4: Real-World Workload (5 Test Cases)', () => {

  // ==========================================
  // T4.1: Полный сценарий мобильного отчета в Telegram
  // ==========================================
  test('T4.1: Complete mobile report scenario in Telegram', async ({ context }) => {
    // Emulate iPhone 12
    const iphone = devices['iPhone 12'];
    const page = await context.newPage({
      ...iphone,
      userAgent: iphone.userAgent,
    });
    
    await page.goto('/');

    // Verify mobile tab layout is active
    const listTab = page.locator('#showListTab');
    await expect(listTab).toBeVisible();
    await listTab.click(); // Switch to list view on mobile

    // Click reporting button
    await page.click('#reportButton');

    // Fill Step 1
    await page.fill('#draftArea', 'Москва, ЮЗАО');
    await page.fill('#draftOperator', 'МТС');
    await page.selectOption('#draftNetwork', { label: 'Мобильный интернет' });
    await page.click('#nextStepButton');

    // Fill Step 2
    await page.selectOption('#draftProblem', { label: 'Работает только белый список' });
    // Click service pills
    const pills = page.locator('.service-pill');
    if (await pills.count() > 1) {
      await pills.nth(0).click(); // Telegram
      await pills.nth(1).click(); // YouTube
    } else {
      await page.fill('#draftServices', 'Telegram, YouTube');
    }
    await page.click('#nextStepButton');

    // Fill Step 3
    await page.fill('#draftSummary', 'Мессенджер работает, сайты заблокированы');

    // Submit and check Telegram link
    const [newPage] = await Promise.all([
      context.waitForEvent('page', { timeout: 5000 }).catch(() => null),
      page.click('#submitFormButton')
    ]);

    expect(newPage).not.toBeNull();
    if (newPage) {
      const urlObj = new URL(newPage.url());
      expect(urlObj.origin).toBe('https://t.me');
      expect(urlObj.pathname).toBe('/WhiteS_Bot');
      
      const textParam = urlObj.searchParams.get('text') || '';
      expect(textParam).toContain('Москва, ЮЗАО');
      expect(textParam).toContain('МТС');
      expect(textParam).toContain('Работает только белый список');
      expect(textParam).toContain('Мессенджер работает, сайты заблокированы');
    }
  });

  // ==========================================
  // T4.2: Сценарий офлайн-анализа и фильтрации
  // ==========================================
  test('T4.2: Offline analysis and filtration scenario', async ({ context, page }) => {
    await page.goto('/');
    
    // Wait for Service Worker registration or localStorage cache
    await page.waitForFunction(() => {
      return localStorage.getItem('whites:reports-cache') !== null || typeof window['state'] !== 'undefined';
    });

    // Go offline
    await context.setOffline(true);
    await page.reload();

    // Open overflow menu and turn off tiles
    await page.click('#overflowToggle');
    await page.click('#tileModeButton'); // Toggles state.useTiles to false
    
    // Check map silhouette path visibility and warning display
    await expect(page.locator('#tileWarning')).toBeVisible();
    await expect(page.locator('.map-silhouette')).toBeVisible();

    // Type in search bar
    await page.fill('#searchInput', 'Билайн');
    
    // Click on the first card
    const firstCard = page.locator('.reports-list .report-row').first();
    if (await firstCard.count() > 0) {
      await firstCard.click();
      
      // Verify map panned and popup opened
      const popup = page.locator('.leaflet-popup');
      await expect(popup).toBeVisible();
    }
  });

  // ==========================================
  // T4.3: Проверка доступности и контрастности интерфейса
  // ==========================================
  test('T4.3: Accessibility and contrast audit', async ({ page }) => {
    await page.goto('/');

    // Check accessibility of critical elements via key tab focus navigation
    const searchInput = page.locator('#searchInput');
    await page.keyboard.press('Tab');
    
    let activeElementId = await page.evaluate(() => document.activeElement?.id);
    expect(activeElementId).not.toBeNull();

    // Check contrast ratio of default body text
    const contrast = await page.evaluate(() => {
      function getRGB(colorStr) {
        const match = colorStr.match(/\d+/g);
        return match ? match.map(Number) : [0, 0, 0];
      }
      function getLuminance(r, g, b) {
        const a = [r, g, b].map(v => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      }
      
      const body = document.body;
      const fgColor = getRGB(getComputedStyle(body).color);
      const bgColor = getRGB(getComputedStyle(body).backgroundColor);
      
      const l1 = getLuminance(fgColor[0], fgColor[1], fgColor[2]);
      const l2 = getLuminance(bgColor[0], bgColor[1], bgColor[2]);
      
      const brightest = Math.max(l1, l2);
      const darkest = Math.min(l1, l2);
      
      return (brightest + 0.05) / (darkest + 0.05);
    });

    expect(contrast).toBeGreaterThanOrEqual(4.5); // WCAG AA Compliance
  });

  // ==========================================
  // T4.4: Нагрузочное тестирование карты и списка
  // ==========================================
  test('T4.4: Load testing with 1000 reports', async ({ page }) => {
    await page.goto('/');

    // Inject 1000 mock reports into the page application state
    const loadTime = await page.evaluate(() => {
      const startTime = performance.now();
      const mockReports = [];
      for (let i = 0; i < 1000; i++) {
        mockReports.push({
          id: `mock-${i}`,
          city_or_area: `Город-${i}`,
          region: 'Краснодарский край',
          operator: i % 2 === 0 ? 'МегаФон' : 'Билайн',
          network: 'Мобильный интернет',
          problem: 'Полное отключение',
          services: 'Telegram, WhatsApp',
          summary: `Описание проблемы номер ${i}`,
          timestamp: new Date().toISOString(),
          confidence: 'Проверил сам',
          lat: 45.0 + (Math.random() - 0.5) * 5,
          lng: 39.0 + (Math.random() - 0.5) * 5
        });
      }
      
      // Update app state and re-render
      if (window['state'] && typeof window['renderData'] === 'function') {
        window['state'].reports = mockReports;
        window['renderData']();
      }
      
      return performance.now() - startTime;
    });

    // Check that rendering 1000 items takes less than 150ms
    expect(loadTime).toBeLessThan(150);

    // Verify reports list scrollability and structure
    const firstRow = page.locator('.reports-list .report-row').first();
    await expect(firstRow).toBeVisible();
  });

  // ==========================================
  // T4.5: Сценарий обмена состоянием через URL
  // ==========================================
  test('T4.5: State sharing via URL parameters', async ({ page }) => {
    await page.goto('/');

    // Set filters via inputs
    await page.fill('#searchInput', 'Краснодар');
    await page.selectOption('#problemFilter', { label: 'Работает только белый список' });
    await page.selectOption('#operatorFilter', { label: 'МегаФон' });

    // Verify URL parameters updated automatically
    const url = page.url();
    expect(url).toContain('q=Краснодар');
    expect(url).toContain('problem=');
    expect(url).toContain('operator=');

    // Open a new page with the generated URL
    await page.goto(url);

    // Verify the filters are restored from URL
    const searchVal = await page.inputValue('#searchInput');
    expect(searchVal).toBe('Краснодар');

    const selectedProblem = await page.locator('#problemFilter option:checked').textContent();
    expect(selectedProblem?.trim()).toBe('Работает только белый список');

    const selectedOperator = await page.locator('#operatorFilter option:checked').textContent();
    expect(selectedOperator?.trim()).toBe('МегаФон');
  });
});
