// @ts-check
const { test, expect, devices } = require('@playwright/test');

test.describe('Tier 4: Real-World Workload (6 Test Cases)', () => {

  // ==========================================
  // T4.1: Полный сценарий мобильного отчета в Telegram
  // ==========================================
  test('T4.1: Complete mobile report scenario in Telegram', async ({ context }) => {
    // Emulate iPhone 12
    const iphone = devices['iPhone 12'];
    const page = await context.newPage();
    await page.setViewportSize(iphone.viewport);
    
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
      await page.fill('#draftServicesOther', 'Telegram, YouTube');
    }
    await page.click('#nextStepButton');

    // Fill Step 3
    await page.fill('#draftSummary', 'Мессенджер работает, сайты заблокированы');

    // The submit button carries the exact Telegram link the app opens via
    // window.open. Assert on the href deterministically (the popup capture
    // itself is racy under full-suite load), then confirm a tab is opened.
    const submitButton = page.locator('#submitFormButton');
    const href = await submitButton.getAttribute('href');
    expect(href).not.toBeNull();

    const urlObj = new URL(href);
    expect(urlObj.origin).toBe('https://t.me');
    expect(urlObj.pathname).toBe('/WhiteS_Bot');

    const textParam = urlObj.searchParams.get('text') || '';
    expect(textParam).toContain('Москва, ЮЗАО');
    expect(textParam).toContain('МТС');
    expect(textParam).toContain('Работает только белый список');
    expect(textParam).toContain('Мессенджер работает, сайты заблокированы');

    // The click should open the Telegram link in a new browser tab.
    const [newPage] = await Promise.all([
      context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
      submitButton.click()
    ]);
    expect(newPage).not.toBeNull();
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

    // Wait for Service Worker to be ready, but keep the workload bounded.
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return;
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((r) => setTimeout(r, 1500)),
      ]);
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
    expect(activeElementId).not.toBe('');

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
    const url = decodeURIComponent(page.url());
    expect(url).toContain('search=Краснодар');
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

  // ==========================================
  // T4.6: Жалоба на опасную публичную отметку
  // ==========================================
  test('T4.6: Safety complaint draft for a public report', async ({ context, page }) => {
    await page.goto('/');

    const issueButton = page.locator('.reports-list .issue-report-button').first();
    await expect(issueButton).toBeVisible();
    await issueButton.click();

    await expect(page.locator('#issueDialog')).toBeVisible();
    await page.selectOption('#issueReason', { label: 'Персональные данные или точный адрес' });
    await page.fill('#issueComment', 'Проверьте, не раскрывает ли запись лишние детали');

    const draft = await page.inputValue('#issueDraftOutput');
    expect(draft).toContain('WhiteS: жалоба на публичную отметку');
    expect(draft).toContain('ID отметки:');
    expect(draft).toContain('Персональные данные или точный адрес');
    expect(draft).toContain('Проверьте, не раскрывает ли запись лишние детали');

    // Assert on the button href deterministically (popup capture is racy).
    const submitIssue = page.locator('#submitIssueButton');
    const href = await submitIssue.getAttribute('href');
    expect(href).not.toBeNull();
    const urlObj = new URL(href);
    expect(urlObj.origin).toBe('https://t.me');
    expect(urlObj.pathname).toBe('/WhiteS_Bot');
    const textParam = urlObj.searchParams.get('text') || '';
    expect(textParam).toContain('жалоба на публичную отметку');
    expect(textParam).toContain('Персональные данные или точный адрес');

    // The click opens the Telegram draft in a new tab.
    const [newPage] = await Promise.all([
      page.waitForEvent('popup', { timeout: 15000 }).catch(() => null),
      submitIssue.click()
    ]);
    expect(newPage).not.toBeNull();
  });

  // ==========================================
  // T4.7: Подтверждение «Я тоже это вижу»
  // ==========================================
  test('T4.7: "I see it too" confirmation increments and locks per device', async ({ page }) => {
    await page.goto('/');

    const firstRow = page.locator('.reports-list .report-row').first();
    await expect(firstRow).toBeVisible();

    const confirmButton = firstRow.locator('.confirm-button');
    const reportId = await confirmButton.getAttribute('data-report-confirm');
    expect(reportId).not.toBeNull();

    const countBefore = await page.evaluate((id) => {
      const r = window.state.data.reports.find((x) => x.id === id);
      return Number(r?.confirmation_count) || 0;
    }, reportId);

    await confirmButton.click();

    // Optimistic increment reflected in state and in the count tag.
    const countAfter = await page.evaluate((id) => {
      const r = window.state.data.reports.find((x) => x.id === id);
      return Number(r?.confirmation_count) || 0;
    }, reportId);
    expect(countAfter).toBe(countBefore + 1);

    const countTag = firstRow.locator('[data-confirmation-count]');
    await expect(countTag).toHaveText(`${countBefore + 1} подтвердили`);

    // Button locks after confirming.
    await expect(confirmButton).toBeDisabled();
    await expect(confirmButton).toHaveText('Вы подтвердили');

    // Device is remembered so it cannot confirm the same report twice.
    const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('whites:confirmed') || '[]'));
    expect(persisted).toContain(reportId);

    // Reload: the lock survives from localStorage.
    await page.reload();
    const reloadedButton = page.locator(`.reports-list .report-row .confirm-button[data-report-confirm="${reportId}"]`);
    await expect(reloadedButton).toBeDisabled();
  });

  // ==========================================
  // T4.8: Единый индикатор доверия на карточках
  // ==========================================
  test('T4.8: Every card shows a trust indicator with a graded level', async ({ page }) => {
    await page.goto('/');

    const rows = page.locator('.reports-list .report-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Each visible card carries a trust badge with a non-empty, graded label.
    for (let i = 0; i < count; i += 1) {
      const badge = rows.nth(i).locator('.trust-badge');
      await expect(badge).toHaveCount(1);
      const cls = await badge.getAttribute('class');
      expect(cls).toMatch(/trust-(high|medium|low)/);
      const text = (await badge.textContent())?.trim() || '';
      expect(text.length).toBeGreaterThan(0);
    }

    // The badge grade is computed in the app (freshness + confidence + confirmations).
    const grades = await page.evaluate(() =>
      window.state.data.reports
        .filter((r) => !r.status || r.status === 'published')
        .map((r) => {
          const el = document.querySelector(`.report-row[data-report-id="${r.id}"] .trust-badge`);
          return el ? el.className : null;
        })
    );
    expect(grades.every((g) => g && /trust-(high|medium|low)/.test(g))).toBe(true);
  });

  // ==========================================
  // T4.9: Deep-link ?report=<id> открывает и подсвечивает отметку
  // ==========================================
  test('T4.9: report deep-link selects and highlights the target report', async ({ page }) => {
    await page.goto('/?report=report-002');

    // The targeted report becomes the selected one in app state.
    await page.waitForFunction(() => window.state && window.state.selectedId === 'report-002');

    // Its list row is marked active/current.
    const row = page.locator('.report-row[data-report-id="report-002"]');
    await expect(row).toHaveClass(/is-active/);
    await expect(row).toHaveAttribute('aria-current', 'true');

    // Header share now produces a report-specific permalink + text.
    const shared = await page.evaluate(async () => {
      const calls = [];
      const original = navigator.share;
      navigator.share = (data) => { calls.push(data); return Promise.resolve(); };
      try {
        await document.querySelector('#shareButton').click();
      } finally {
        navigator.share = original;
      }
      return calls[0] || null;
    });
    expect(shared).not.toBeNull();
    expect(shared.url).toContain('?report=report-002');
    expect(shared.text).toContain('WhiteS');
  });

  // ==========================================
  // T4.10: Privacy-safe analytics events
  // ==========================================
  test('T4.10: privacy-safe analytics sends only allowlisted event names', async ({ page }) => {
    const tracked = [];
    await page.route('**/api/event.php', async (route) => {
      const data = route.request().postDataJSON();
      tracked.push(data.event);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto(`/?region=${encodeURIComponent('москва')}`);
    await expect.poll(() => tracked).toContain('deeplink_open');
    await expect.poll(() => tracked).toContain('region_page_view');

    await page.locator('#shareButton').click();
    await expect.poll(() => tracked).toContain('share_clicked');

    await page.locator('.reports-list .confirm-button').first().click();
    await expect.poll(() => tracked).toContain('confirm_clicked');

    const allowed = ['share_clicked', 'confirm_clicked', 'report_submitted', 'deeplink_open', 'region_page_view'];
    expect(tracked.every((eventName) => allowed.includes(eventName))).toBe(true);
  });
});
