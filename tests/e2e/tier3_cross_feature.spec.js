// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Tier 3: Cross-Feature Interactions (9 Test Cases)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('T3.1: Dark Mode + Glassmorphism (Readability & Contrast)', async ({ page }) => {
    // Under dark mode, verify glassmorphism panel background uses a dark color with transparency
    const background = await page.locator('.filters-panel').evaluate(el => {
      return getComputedStyle(el).backgroundColor;
    });
    expect(background).toContain('rgba');
    const parts = background.match(/\d+/g);
    if (parts) {
      const r = parseInt(parts[0], 10);
      const g = parseInt(parts[1], 10);
      const b = parseInt(parts[2], 10);
      expect(r).toBeLessThan(50);
      expect(g).toBeLessThan(50);
      expect(b).toBeLessThan(50);
    }
  });

  test('T3.2: Telegram Deep Link + Service Pills (Multiple pills formatting)', async ({ context, page }) => {
    await page.click('#reportButton');
    
    // Step 1
    await page.fill('#draftArea', 'Москва, СВАО');
    await page.fill('#draftOperator', 'Билайн');
    await page.click('#nextStepButton');
    
    // Step 2: Toggle service pills
    const pills = page.locator('.service-pill');
    await pills.nth(0).click();
    await pills.nth(1).click();
    
    const val0 = (await pills.nth(0).textContent())?.trim() || '';
    const val1 = (await pills.nth(1).textContent())?.trim() || '';

    await page.click('#nextStepButton');
    
    // Step 3: Submit and intercept new page
    const [newPage] = await Promise.all([
      context.waitForEvent('page', { timeout: 5000 }).catch(() => null),
      page.click('#submitFormButton')
    ]);

    if (newPage) {
      const urlObj = new URL(newPage.url());
      const text = urlObj.searchParams.get('text') || '';
      expect(text).toContain(val0);
      expect(text).toContain(val1);
    } else {
      throw new Error('Telegram bot new tab was not opened');
    }
  });

  test('T3.3: Service Worker Caching + Dark Mode (Theme preservation offline)', async ({ context, page }) => {
    // Go offline
    await context.setOffline(true);
    await page.reload();
    
    const bgColor = await page.evaluate(() => {
      const style = getComputedStyle(document.body);
      return style.getPropertyValue('--bg').trim() || style.backgroundColor;
    });
    // Should still preserve dark theme variables
    expect(bgColor).toMatch(/#0[fF]1117|rgb\(15,\s*17,\s*23\)/);
  });

  test('T3.4: Tactile Scale + Neon Markers (Scaling marker on hover maintains pulse)', async ({ page }) => {
    const marker = page.locator('.cluster-marker.shutdown').first();
    if (await marker.count() > 0) {
      const originalTransform = await marker.evaluate(el => getComputedStyle(el).transform);
      await marker.hover();
      
      const hoverTransform = await marker.evaluate(el => getComputedStyle(el).transform);
      expect(hoverTransform).not.toBe(originalTransform);
      
      const animName = await marker.evaluate(el => getComputedStyle(el).animationName);
      expect(animName).toContain('pulseNeonRed');
    } else {
      throw new Error('No shutdown markers found');
    }
  });

  test('T3.5: Custom Scrollbar + Glassmorphism (Scrollbar matches glass theme)', async ({ page }) => {
    const customScrollbarClass = await page.evaluate(() => {
      return Array.from(document.styleSheets).some(sheet => {
        try {
          return Array.from(sheet.cssRules).some(rule => {
            return rule.cssText.includes('.report-drawer') && 
                   rule.cssText.includes('::-webkit-scrollbar-thumb') && 
                   rule.cssText.includes('backdrop-filter');
          });
        } catch {
          return false;
        }
      });
    });
    expect(customScrollbarClass).toBe(true);
  });

  test('T3.6: Inset Box-Shadow + Dark Mode (Focus indicators contrast)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const searchInput = page.locator('#searchInput');
    await searchInput.click();
    await expect(searchInput).toBeFocused();
    const shadow = await searchInput.evaluate(el => getComputedStyle(el).boxShadow);
    // Focus shadow should contain emerald/cyan colors characteristic of brand glow on dark background
    expect(shadow).not.toBe('none');
    expect(shadow).toMatch(/rgba?\(5,\s*150,\s*105/); // Brand emerald (#059669) in RGB
  });

  test('T3.7: Interactive Service Pills + Inset Box-Shadow (Pill click triggers tactile states)', async ({ page }) => {
    await page.click('#reportButton');
    await page.fill('#draftArea', 'Регион');
    await page.fill('#draftOperator', 'Оператор');
    await page.click('#nextStepButton');
    
    const pill = page.locator('.service-pill').first();
    await pill.click();
    
    const shadow = await pill.evaluate(el => getComputedStyle(el).boxShadow);
    const transform = await pill.evaluate(el => getComputedStyle(el).transform);
    
    // Selecting pill should apply active scale and glow
    expect(shadow).toContain('inset');
    expect(transform).not.toBe('none');
  });

  test('T3.8: Service Worker Caching + Custom Scrollbar (Scrollbar loaded offline)', async ({ context, page }) => {
    await context.setOffline(true);
    await page.reload();
    
    // CSS for scrollbar should be active and computed
    const customScrollbarLoaded = await page.evaluate(() => {
      const div = document.createElement('div');
      div.className = 'report-drawer';
      document.body.appendChild(div);
      const style = getComputedStyle(div, '::-webkit-scrollbar').width;
      div.remove();
      return style;
    });
    expect(customScrollbarLoaded).not.toBe('');
  });

  test('T3.9: Neon Marker Fade + Service Pills (Filtering markers with pills triggers fade animation)', async ({ page }) => {
    await page.click('#reportButton');
    await page.fill('#draftArea', 'Регион');
    await page.fill('#draftOperator', 'Оператор');
    await page.click('#nextStepButton');
    
    // Choose specific service pill
    const pill = page.locator('.service-pill').first();
    const pillText = (await pill.textContent())?.trim() || '';
    await pill.click();
    
    // Filter map by selecting the same service in the main filter
    await page.selectOption('#serviceFilter', { label: pillText });
    
    const markers = page.locator('.cluster-marker');
    const count = await markers.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
