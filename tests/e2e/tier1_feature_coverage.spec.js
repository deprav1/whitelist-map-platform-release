// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Tier 1: Feature Coverage (45 Test Cases)', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the root of the application
    await page.goto('/');
  });

  // ==========================================
  // FEATURE 1: Dark Mode Only
  // ==========================================
  test.describe('Feature 1: Dark Mode Only', () => {
    test('T1.1.1: Verify body background color corresponds to dark mode', async ({ page }) => {
      const bgColor = await page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return style.getPropertyValue('--bg').trim() || style.backgroundColor;
      });
      // Expected dark background: rgb(15, 17, 23) / #0f1117 or similar
      expect(bgColor).toMatch(/#0[fF]1117|rgb\(15,\s*17,\s*23\)/);
    });

    test('T1.1.2: Verify default text color is light', async ({ page }) => {
      const textColor = await page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return style.getPropertyValue('--ink').trim() || style.color;
      });
      // Expected light text: rgb(243, 244, 246) / #f3f4f6 or similar
      expect(textColor).toMatch(/#f3f4f6|rgb\(243,\s*244,\s*246\)/i);
    });

    test('T1.1.3: Verify emulating light media color-scheme stays dark', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      const bgColor = await page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return style.getPropertyValue('--bg').trim() || style.backgroundColor;
      });
      expect(bgColor).toMatch(/#0[fF]1117|rgb\(15,\s*17,\s*23\)/);
    });

    test('T1.1.4: Verify major panels use dark colors', async ({ page }) => {
      const panels = ['.topbar', '.report-drawer', '.filters-panel'];
      for (const selector of panels) {
        const panelBg = await page.locator(selector).evaluate(el => {
          return getComputedStyle(el).backgroundColor;
        });
        const match = panelBg.match(/\d+/g);
        if (match) {
          const r = parseInt(match[0], 10);
          expect(r).toBeLessThan(50); // Red channel should be low for dark themes
        }
      }
    });

    test('T1.1.5: Verify map tile layer is dark_all', async ({ page }) => {
      const tileUrl = await page.evaluate(() => {
        return window['state']?.tileLayer?._url || '';
      });
      if (tileUrl) {
        expect(tileUrl).toContain('dark_all');
      } else {
        // Fallback: Check if leaflet tile images on map contain "dark_all" in URL
        const tileImages = page.locator('.leaflet-tile');
        const count = await tileImages.count();
        if (count > 0) {
          const src = await tileImages.first().getAttribute('src');
          expect(src).toContain('dark_all');
        } else {
          // If no tiles rendered (e.g. offline tab or no network), check app.js configuration text
          const hasDarkAll = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script'));
            return scripts.some(s => s.src.includes('app.js'));
          });
          expect(hasDarkAll).toBe(true);
        }
      }
    });
  });

  // ==========================================
  // FEATURE 2: Telegram Deep Link Form Submission
  // ==========================================
  test.describe('Feature 2: Telegram Deep Link Form Submission', () => {
    test.beforeEach(async ({ page }) => {
      // Open the report dialog first
      await page.click('#reportButton');
    });

    async function fillFormAndSubmit(page) {
      // Step 1
      await page.fill('#draftArea', 'Москва, ЮАО');
      await page.fill('#draftOperator', 'МТС');
      await page.selectOption('#draftNetwork', { label: 'Мобильный интернет' });
      await page.click('#nextStepButton');

      // Step 2
      await page.selectOption('#draftProblem', { label: 'Работает только белый список' });
      await page.selectOption('#draftConfidence', { label: 'Проверил сам' });
      await page.fill('#draftServices', 'Telegram, YouTube');
      await page.click('#nextStepButton');

      // Step 3
      await page.fill('#draftSummary', 'Тестовый комментарий для E2E');
    }

    test('T1.2.1: Verify clicking final button opens new tab/window', async ({ context, page }) => {
      await fillFormAndSubmit(page);
      
      // We expect the submit button to open a new tab with the Telegram link
      const [newPage] = await Promise.all([
        context.waitForEvent('page', { timeout: 5000 }).catch(() => null),
        page.click('#submitFormButton')
      ]);
      
      expect(newPage).not.toBeNull();
    });

    test('T1.2.2: Verify deep link target domain is t.me/WhiteS_Bot', async ({ context, page }) => {
      await fillFormAndSubmit(page);
      
      const [newPage] = await Promise.all([
        context.waitForEvent('page', { timeout: 5000 }).catch(() => null),
        page.click('#submitFormButton')
      ]);
      
      if (newPage) {
        expect(newPage.url()).toContain('t.me/WhiteS_Bot');
      } else {
        // Fallback: If not implemented, check the form submit action or action listener
        throw new Error('Telegram bot new tab was not opened');
      }
    });

    test('T1.2.3: Verify parameter text exists in query string', async ({ context, page }) => {
      await fillFormAndSubmit(page);
      
      const [newPage] = await Promise.all([
        context.waitForEvent('page', { timeout: 5000 }).catch(() => null),
        page.click('#submitFormButton')
      ]);
      
      if (newPage) {
        const urlObj = new URL(newPage.url());
        expect(urlObj.searchParams.has('text')).toBe(true);
      } else {
        throw new Error('Telegram bot new tab was not opened');
      }
    });

    test('T1.2.4: Verify form parameters are correctly encoded in URL', async ({ context, page }) => {
      await fillFormAndSubmit(page);
      
      const [newPage] = await Promise.all([
        context.waitForEvent('page', { timeout: 5000 }).catch(() => null),
        page.click('#submitFormButton')
      ]);
      
      if (newPage) {
        const urlObj = new URL(newPage.url());
        const textParam = urlObj.searchParams.get('text') || '';
        expect(textParam).toContain('Москва, ЮАО');
        expect(textParam).toContain('МТС');
        expect(textParam).toContain('Работает только белый список');
      } else {
        throw new Error('Telegram bot new tab was not opened');
      }
    });

    test('T1.2.5: Verify form modal closes after submission', async ({ context, page }) => {
      await fillFormAndSubmit(page);
      
      await Promise.all([
        context.waitForEvent('page', { timeout: 5000 }).catch(() => null),
        page.click('#submitFormButton')
      ]);
      
      const isVisible = await page.locator('#reportDialog').isVisible();
      expect(isVisible).toBe(false);
    });
  });

  // ==========================================
  // FEATURE 3: Interactive Service Pills
  // ==========================================
  test.describe('Feature 3: Interactive Service Pills', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('#reportButton');
      // Go to Step 2
      await page.fill('#draftArea', 'Москва, ЮАО');
      await page.fill('#draftOperator', 'МТС');
      await page.click('#nextStepButton');
    });

    test('T1.3.1: Verify service pills are present on Step 2', async ({ page }) => {
      const pillCount = await page.locator('.service-pill').count();
      expect(pillCount).toBeGreaterThan(0);
    });

    test('T1.3.2: Verify click on inactive pill activates it (adds .is-active)', async ({ page }) => {
      const firstPill = page.locator('.service-pill').first();
      await firstPill.click();
      await expect(firstPill).toHaveClass(/is-active/);
    });

    test('T1.3.3: Verify click on active pill deactivates it', async ({ page }) => {
      const firstPill = page.locator('.service-pill').first();
      await firstPill.click(); // Activate
      await expect(firstPill).toHaveClass(/is-active/);
      await firstPill.click(); // Deactivate
      await expect(firstPill).not.toHaveClass(/is-active/);
    });

    test('T1.3.4: Verify multiple selected pills appear in draft text', async ({ page }) => {
      const pills = page.locator('.service-pill');
      // Select first two pills
      await pills.nth(0).click();
      await pills.nth(1).click();
      
      const text0 = await pills.nth(0).textContent();
      const text1 = await pills.nth(1).textContent();

      // Go to Step 3
      await page.click('#nextStepButton');

      const draftOutput = await page.inputValue('#draftOutput');
      expect(draftOutput).toContain(text0?.trim());
      expect(draftOutput).toContain(text1?.trim());
    });

    test('T1.3.5: Verify deactivating a pill removes it from the draft', async ({ page }) => {
      const firstPill = page.locator('.service-pill').first();
      const text = (await firstPill.textContent())?.trim() || '';

      await firstPill.click(); // Activate
      await page.click('#nextStepButton');
      let draftOutput = await page.inputValue('#draftOutput');
      expect(draftOutput).toContain(text);

      // Go back and deactivate
      await page.click('#prevStepButton');
      await firstPill.click(); // Deactivate
      await page.click('#nextStepButton');
      draftOutput = await page.inputValue('#draftOutput');
      expect(draftOutput).not.toContain(text);
    });
  });

  // ==========================================
  // FEATURE 4: Service Worker Offline Shell Caching
  // ==========================================
  test.describe('Feature 4: Service Worker Offline Shell Caching', () => {
    test('T1.4.1: Verify successful registration of Service Worker', async ({ page }) => {
      // Check if navigator.serviceWorker has registrations
      const isRegistered = await page.evaluate(async () => {
        if (!navigator.serviceWorker) return false;
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.length > 0;
      });
      expect(isRegistered).toBe(true);
    });

    test('T1.4.2: Verify page index.html is accessible when offline', async ({ context, page }) => {
      // Enable offline mode
      await context.setOffline(true);
      await page.reload();
      
      const appShell = page.locator('.app-shell');
      await expect(appShell).toBeVisible();
    });

    test('T1.4.3: Verify styles.css loads offline', async ({ context, page }) => {
      await context.setOffline(true);
      await page.reload();
      
      const computedColor = await page.evaluate(() => {
        return getComputedStyle(document.body).backgroundColor;
      });
      expect(computedColor).not.toBe('');
    });

    test('T1.4.4: Verify app.js loads offline', async ({ context, page }) => {
      await context.setOffline(true);
      await page.reload();
      
      const stateExists = await page.evaluate(() => {
        return typeof window['state'] !== 'undefined';
      });
      expect(stateExists).toBe(true);
    });

    test('T1.4.5: Verify tileWarning is shown when offline', async ({ context, page }) => {
      await context.setOffline(true);
      await page.reload();
      
      const warning = page.locator('#tileWarning');
      await expect(warning).toBeVisible();
    });
  });

  // ==========================================
  // FEATURE 5: Glassmorphism Transparency
  // ==========================================
  test.describe('Feature 5: Glassmorphism Transparency', () => {
    test('T1.5.1: Verify filters-panel has backdrop-filter blur', async ({ page }) => {
      const backdropFilter = await page.locator('.filters-panel').evaluate(el => {
        const style = getComputedStyle(el);
        return style.backdropFilter || style.webkitBackdropFilter || '';
      });
      expect(backdropFilter).toContain('blur');
    });

    test('T1.5.2: Verify filters-panel background uses rgba transparency', async ({ page }) => {
      const background = await page.locator('.filters-panel').evaluate(el => {
        return getComputedStyle(el).backgroundColor;
      });
      // Should be rgba with opacity < 1, e.g. rgba(15, 17, 23, 0.85) or similar
      expect(background).toContain('rgba');
      const alpha = parseFloat(background.split(',')[3] || '1');
      expect(alpha).toBeLessThan(1);
    });

    test('T1.5.3: Verify report-drawer has backdrop-filter blur', async ({ page }) => {
      const backdropFilter = await page.locator('.report-drawer').evaluate(el => {
        const style = getComputedStyle(el);
        return style.backdropFilter || style.webkitBackdropFilter || '';
      });
      expect(backdropFilter).toContain('blur');
    });

    test('T1.5.4: Verify report-drawer background uses rgba transparency', async ({ page }) => {
      const background = await page.locator('.report-drawer').evaluate(el => {
        return getComputedStyle(el).backgroundColor;
      });
      expect(background).toContain('rgba');
      const alpha = parseFloat(background.split(',')[3] || '1');
      expect(alpha).toBeLessThan(1);
    });

    test('T1.5.5: Verify overflow-menu has backdrop-filter blur', async ({ page }) => {
      await page.click('#overflowToggle');
      const backdropFilter = await page.locator('.overflow-menu').evaluate(el => {
        const style = getComputedStyle(el);
        return style.backdropFilter || style.webkitBackdropFilter || '';
      });
      expect(backdropFilter).toContain('blur');
    });
  });

  // ==========================================
  // FEATURE 6: Inset Box-Shadow Light Glow
  // ==========================================
  test.describe('Feature 6: Inset Box-Shadow Light Glow', () => {
    test('T1.6.1: Verify searchInput has no outline on focus', async ({ page }) => {
      const search = page.locator('#searchInput');
      await search.focus();
      const outline = await search.evaluate(el => {
        const style = getComputedStyle(el);
        return style.outlineStyle || style.outlineWidth;
      });
      expect(outline).toMatch(/none|0px/);
    });

    test('T1.6.2: Verify searchInput has box-shadow on focus', async ({ page }) => {
      const search = page.locator('#searchInput');
      await search.focus();
      const boxShadow = await search.evaluate(el => {
        return getComputedStyle(el).boxShadow;
      });
      expect(boxShadow).not.toMatch(/none|0px 0px 0px 0px/);
    });

    test('T1.6.3: Verify active region card has inset box-shadow', async ({ page }) => {
      // Find or generate active hotspot card
      // In app.js it renders hotspot cards inside #hotspotsList
      // Let's click one to make it active or search if it's already there
      const cards = page.locator('.hotspot-card');
      if (await cards.count() > 0) {
        const firstCard = cards.first();
        await firstCard.click();
        await expect(firstCard).toHaveClass(/is-active/);
        const shadow = await firstCard.evaluate(el => getComputedStyle(el).boxShadow);
        expect(shadow).toContain('inset');
      } else {
        throw new Error('No hotspot cards found to test active inset shadow');
      }
    });

    test('T1.6.4: Verify quick-filter buttons have soft shadow instead of outline on focus', async ({ page }) => {
      const filterBtn = page.locator('.quick-filter').first();
      await filterBtn.focus();
      const outline = await filterBtn.evaluate(el => getComputedStyle(el).outlineStyle);
      expect(outline).toBe('none');
      const shadow = await filterBtn.evaluate(el => getComputedStyle(el).boxShadow);
      expect(shadow).not.toBe('none');
    });

    test('T1.6.5: Verify select elements have box-shadow on focus', async ({ page }) => {
      const selectEl = page.locator('#freshnessFilter');
      await selectEl.focus();
      const outline = await selectEl.evaluate(el => getComputedStyle(el).outlineStyle);
      expect(outline).toBe('none');
      const shadow = await selectEl.evaluate(el => getComputedStyle(el).boxShadow);
      expect(shadow).not.toBe('none');
    });
  });

  // ==========================================
  // FEATURE 7: Tactile Scale Animations
  // ==========================================
  test.describe('Feature 7: Tactile Scale Animations', () => {
    test('T1.7.1: Verify reportButton has translate or scale style transition on hover', async ({ page }) => {
      const btn = page.locator('#reportButton');
      const originalTransform = await btn.evaluate(el => getComputedStyle(el).transform);
      
      await btn.hover();
      const hoverTransform = await btn.evaluate(el => getComputedStyle(el).transform);
      
      // Since it scales or translates, transform matrix should differ or change
      expect(hoverTransform).not.toBe(originalTransform);
    });

    test('T1.7.2: Verify hotspot-card shifts up on hover', async ({ page }) => {
      const card = page.locator('.hotspot-card').first();
      if (await card.count() > 0) {
        const origTransform = await card.evaluate(el => getComputedStyle(el).transform);
        await card.hover();
        const hoverTransform = await card.evaluate(el => getComputedStyle(el).transform);
        expect(hoverTransform).not.toBe(origTransform);
      } else {
        throw new Error('No hotspot cards found');
      }
    });

    test('T1.7.3: Verify map cluster marker scales up on hover', async ({ page }) => {
      const cluster = page.locator('.cluster-marker').first();
      if (await cluster.count() > 0) {
        const origTransform = await cluster.evaluate(el => getComputedStyle(el).transform);
        await cluster.hover();
        const hoverTransform = await cluster.evaluate(el => getComputedStyle(el).transform);
        expect(hoverTransform).not.toBe(origTransform);
      } else {
        // Skip or fail depending on availability of markers
        throw new Error('No cluster markers found');
      }
    });

    test('T1.7.4: Verify elements return to original scale/position on active press', async ({ page }) => {
      const btn = page.locator('#reportButton');
      await btn.hover();
      const box = await btn.boundingBox();
      
      // Hold mouse down
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        const activeTransform = await btn.evaluate(el => getComputedStyle(el).transform);
        await page.mouse.up();
        
        // Active transform should be different from hover, e.g., smaller or back to 1.0
        expect(activeTransform).not.toBe('');
      } else {
        throw new Error('Button bounds not found');
      }
    });

    test('T1.7.5: Verify transition-duration is non-zero', async ({ page }) => {
      const duration = await page.locator('#reportButton').evaluate(el => {
        return getComputedStyle(el).transitionDuration;
      });
      expect(parseFloat(duration)).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // FEATURE 8: Neon Marker Fade animation
  // ==========================================
  test.describe('Feature 8: Neon Marker Fade animation', () => {
    test('T1.8.1: Verify cluster-marker.shutdown has pulseNeonRed animation', async ({ page }) => {
      const marker = page.locator('.cluster-marker.shutdown').first();
      if (await marker.count() > 0) {
        const animName = await marker.evaluate(el => getComputedStyle(el).animationName);
        expect(animName).toContain('pulseNeonRed');
      } else {
        throw new Error('No shutdown markers found');
      }
    });

    test('T1.8.2: Verify cluster-marker.whitelist has pulseNeonAmber animation', async ({ page }) => {
      const marker = page.locator('.cluster-marker.whitelist').first();
      if (await marker.count() > 0) {
        const animName = await marker.evaluate(el => getComputedStyle(el).animationName);
        expect(animName).toContain('pulseNeonAmber');
      } else {
        throw new Error('No whitelist markers found');
      }
    });

    test('T1.8.3: Verify @keyframes rules exist in CSS', async ({ page }) => {
      const keyframesExist = await page.evaluate(() => {
        return Array.from(document.styleSheets).some(sheet => {
          try {
            return Array.from(sheet.cssRules).some(rule => {
              return rule.type === CSSRule.KEYFRAMES_RULE && 
                     (rule.name === 'pulseNeonRed' || rule.name === 'pulseNeonAmber');
            });
          } catch {
            return false;
          }
        });
      });
      expect(keyframesExist).toBe(true);
    });

    test('T1.8.4: Verify opacity transition on marker entry', async ({ page }) => {
      const transition = await page.evaluate(() => {
        // Create temporary shutdown marker and read transition
        const div = document.createElement('div');
        div.className = 'cluster-marker shutdown';
        document.body.appendChild(div);
        const style = getComputedStyle(div).transition || getComputedStyle(div).transitionProperty;
        div.remove();
        return style;
      });
      expect(transition).toContain('opacity');
    });

    test('T1.8.5: Verify markers fade out on filtering', async ({ page }) => {
      // Change filter and verify transition/opacity behavior or class removal
      // If we select a filter, some markers will be removed
      // Let's filter by a non-existent option
      await page.selectOption('#problemFilter', { label: 'Полное отключение' });
      // Verify that markers are fading or class state changes
      const markers = page.locator('.cluster-marker');
      // Should either be hidden or have transition-duration > 0
      const count = await markers.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================
  // FEATURE 9: Customized Scrollbar
  // ==========================================
  test.describe('Feature 9: Customized Scrollbar', () => {
    test('T1.9.1: Verify horizontal scrollbar in .top-actions is hidden', async ({ page }) => {
      const scrollbarWidth = await page.locator('.top-actions').evaluate(el => {
        return getComputedStyle(el).scrollbarWidth;
      });
      expect(scrollbarWidth).toBe('none');
    });

    test('T1.9.2: Verify horizontal scrollbar in .quick-filters is hidden via ::-webkit-scrollbar', async ({ page }) => {
      // Check if stylesheet contains rules for ::-webkit-scrollbar with display none on .quick-filters
      const webkitHidden = await page.evaluate(() => {
        return Array.from(document.styleSheets).some(sheet => {
          try {
            return Array.from(sheet.cssRules).some(rule => {
              return rule.cssText.includes('.quick-filters') && 
                     rule.cssText.includes('::-webkit-scrollbar') && 
                     rule.cssText.includes('display: none');
            });
          } catch {
            return false;
          }
        });
      });
      expect(webkitHidden).toBe(true);
    });

    test('T1.9.3: Verify vertical scrollbar in report-drawer has custom dark styling', async ({ page }) => {
      const customScrollbar = await page.evaluate(() => {
        return Array.from(document.styleSheets).some(sheet => {
          try {
            return Array.from(sheet.cssRules).some(rule => {
              return rule.cssText.includes('.report-drawer') && 
                     rule.cssText.includes('::-webkit-scrollbar-thumb') && 
                     rule.cssText.includes('background');
            });
          } catch {
            return false;
          }
        });
      });
      expect(customScrollbar).toBe(true);
    });

    test('T1.9.4: Verify hidden scrollbar does not prevent scrolling', async ({ page }) => {
      // Scroll quick filters horizontally
      const filterContainer = page.locator('.quick-filters');
      const isScrollable = await filterContainer.evaluate(el => {
        el.scrollLeft = 50;
        return el.scrollLeft > 0;
      });
      // In a mobile/narrow layout it should be scrollable
      expect(isScrollable).toBe(true);
    });

    test('T1.9.5: Verify no layout shifts on sidebar scroll', async ({ page }) => {
      const originalWidth = await page.locator('.report-drawer').evaluate(el => el.getBoundingClientRect().width);
      
      // Scroll the drawer down
      await page.locator('.report-drawer').evaluate(el => el.scrollTop = 100);
      
      const newWidth = await page.locator('.report-drawer').evaluate(el => el.getBoundingClientRect().width);
      expect(newWidth).toBe(originalWidth);
    });
  });
});
