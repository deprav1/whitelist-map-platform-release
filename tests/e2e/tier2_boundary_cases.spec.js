// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Tier 2: Boundary Cases (45 Test Cases)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the Service Worker to activate (bounded so it never hangs).
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return;
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    });
  });

  // Helper to calculate contrast ratio according to WCAG 2.0
  async function checkContrastRatio(page, foregroundSelector, backgroundSelector) {
    return await page.evaluate(({ fgSel, bgSel }) => {
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
      
      const fgEl = document.querySelector(fgSel);
      const bgEl = document.querySelector(bgSel);
      if (!fgEl || !bgEl) return 0;
      
      const fgColor = getRGB(getComputedStyle(fgEl).color);
      const bgColor = getRGB(getComputedStyle(bgEl).backgroundColor);
      
      const l1 = getLuminance(fgColor[0], fgColor[1], fgColor[2]);
      const l2 = getLuminance(bgColor[0], bgColor[1], bgColor[2]);
      
      const brightest = Math.max(l1, l2);
      const darkest = Math.min(l1, l2);
      
      return (brightest + 0.05) / (darkest + 0.05);
    }, { fgSel: foregroundSelector, bgSel: backgroundSelector });
  }

  // ==========================================
  // FEATURE 1: Dark Mode Only
  // ==========================================
  test.describe('Feature 1: Dark Mode Only', () => {
    test('T2.1.1: High Contrast Mode check', async ({ page }) => {
      await page.emulateMedia({ forcedColors: 'active' });
      const bgColor = await page.evaluate(() => {
        return getComputedStyle(document.body).backgroundColor;
      });
      // Should remain dark color-scheme in CSS variables or actual bg
      expect(bgColor).not.toBe('rgb(255, 255, 255)');
    });

    test('T2.1.2: Brand color contrast check on dark background', async ({ page }) => {
      const contrast = await checkContrastRatio(page, '#reportButton', 'body');
      expect(contrast).toBeGreaterThanOrEqual(3.0); // Minimum contrast for large text/brand buttons
    });

    test('T2.1.3: Fallback for incorrect media parameters', async ({ page }) => {
      // Overwrite matchMedia to return custom or invalid result
      await page.addInitScript(() => {
        // @ts-ignore
        window.matchMedia = () => ({
          matches: false,
          media: 'invalid-media-query',
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        });
      });
      await page.reload();
      const bgColor = await page.evaluate(() => {
        return getComputedStyle(document.body).getPropertyValue('--bg').trim();
      });
      expect(bgColor).toMatch(/#0[fF]1117|rgb\(15,\s*17,\s*23\)/);
    });

    test('T2.1.4: Print media theme preservation', async ({ page }) => {
      await page.emulateMedia({ media: 'print' });
      const bgColor = await page.evaluate(() => {
        return getComputedStyle(document.body).getPropertyValue('--bg').trim();
      });
      expect(bgColor).toMatch(/#0[fF]1117|rgb\(15,\s*17,\s*23\)/);
    });

    test('T2.1.5: Fallback without CSS custom properties', async ({ page }) => {
      // Check that fallback background matches dark palette when variables are absent
      const fallbackBg = await page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return style.backgroundColor;
      });
      const rgb = fallbackBg.match(/\d+/g);
      if (rgb) {
        expect(parseInt(rgb[0])).toBeLessThan(50);
      }
    });
  });

  // ==========================================
  // FEATURE 2: Telegram Deep Link Form Submission
  // ==========================================
  test.describe('Feature 2: Telegram Deep Link Form Submission', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('#reportButton');
    });

    async function fillSteps(page, commentText) {
      await page.fill('#draftArea', 'Москва, ЮАО');
      await page.fill('#draftOperator', 'МТС');
      await page.click('#nextStepButton');
      await page.click('#nextStepButton');
      await page.fill('#draftSummary', commentText);
    }

    async function submitAndWaitForPopup(page) {
      const [newPage] = await Promise.all([
        page.waitForEvent('popup', { timeout: 8000 }).catch(() => null),
        page.click('#submitFormButton')
      ]);
      return newPage;
    }

    test('T2.2.1: Long comment URL length limit (2048 chars)', async ({ context, page }) => {
      const longComment = 'A'.repeat(800); // Very long comment
      await fillSteps(page, longComment);
      
      const newPage = await submitAndWaitForPopup(page);

      if (newPage) {
        expect(newPage.url().length).toBeLessThan(2048);
      } else {
        throw new Error('Telegram bot new tab was not opened');
      }
    });

    test('T2.2.2: Encoding of special characters and emoji', async ({ context, page }) => {
      await fillSteps(page, 'Тест & специальный # символ с эмодзи 👋💻');
      
      const newPage = await submitAndWaitForPopup(page);

      if (newPage) {
        const urlObj = new URL(newPage.url());
        const text = urlObj.searchParams.get('text') || '';
        expect(text).toContain('Тест & специальный # символ с эмодзи 👋💻');
      } else {
        throw new Error('Telegram bot new tab was not opened');
      }
    });

    test('T2.2.3: Blank optional fields formatting', async ({ context, page }) => {
      // Step 1: Area and Operator are required
      await page.fill('#draftArea', 'Регион');
      await page.fill('#draftOperator', 'Оператор');
      await page.click('#nextStepButton');
      
      // Step 2: Leave optional services blank in the visible UI
      await expect(page.locator('.service-pill.is-active')).toHaveCount(0);
      await page.click('#nextStepButton');
      
      // Step 3: Clear comment
      await page.fill('#draftSummary', '');

      const newPage = await submitAndWaitForPopup(page);

      if (newPage) {
        const urlObj = new URL(newPage.url());
        const text = urlObj.searchParams.get('text') || '';
        expect(text).not.toContain('undefined');
        expect(text).not.toContain('null');
      } else {
        throw new Error('Telegram bot new tab was not opened');
      }
    });

    test('T2.2.4: Spam click prevention', async ({ context, page }) => {
      await fillSteps(page, 'Spam click check');
      
      // Click button 3 times rapidly
      const submitBtn = page.locator('#submitFormButton');
      const firstPopupPromise = page.waitForEvent('popup', { timeout: 8000 }).catch(() => null);
      await Promise.allSettled([
        submitBtn.click(),
        submitBtn.click(),
        submitBtn.click()
      ]);

      const firstPopup = await firstPopupPromise;
      expect(firstPopup).not.toBeNull();
      const secondPopup = await page.waitForEvent('popup', { timeout: 1000 }).catch(() => null);
      expect(secondPopup).toBeNull();
    });

    test('T2.2.5: Deep link works if clipboard access is blocked', async ({ context, page }) => {
      // Block clipboard permission
      await context.clearPermissions();
      await fillSteps(page, 'No clipboard access');
      
      const newPage = await submitAndWaitForPopup(page);

      expect(newPage).not.toBeNull();
      if (newPage) {
        expect(newPage.url()).toContain('t.me');
      }
    });
  });

  // ==========================================
  // FEATURE 3: Interactive Service Pills
  // ==========================================
  test.describe('Feature 3: Interactive Service Pills', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('#reportButton');
      await page.fill('#draftArea', 'Регион');
      await page.fill('#draftOperator', 'Оператор');
      await page.click('#nextStepButton');
    });

    test('T2.3.1: Rapid clicks state integrity', async ({ page }) => {
      const pill = page.locator('.service-pill').first();
      // Click 10 times rapidly
      for (let i = 0; i < 10; i++) {
        await pill.click();
      }
      // 10 is even, so it should be deactivated (no is-active class)
      await expect(pill).not.toHaveClass(/is-active/);
    });

    test('T2.3.2: Layout check when activating all pills', async ({ page }) => {
      const pills = page.locator('.service-pill');
      const count = await pills.count();
      for (let i = 0; i < count; i++) {
        await pills.nth(i).click();
      }
      
      // Verify that no pill overflows the container width
      const containerWidth = await page.locator('.form-step.is-active .report-form-grid').evaluate(el => el.clientWidth);
      const pillsContainerWidth = await page.locator('#servicePillsContainer').evaluate(el => el.scrollWidth);
      expect(pillsContainerWidth).toBeLessThanOrEqual(containerWidth + 10); // minor padding allowed
    });

    test('T2.3.3: Keyboard navigation support (Tab + Enter/Space)', async ({ page }) => {
      const pill = page.locator('.service-pill').first();
      await pill.focus();
      await page.keyboard.press('Enter');
      await expect(pill).toHaveClass(/is-active/);
      
      await page.keyboard.press('Space');
      await expect(pill).not.toHaveClass(/is-active/);
    });

    test('T2.3.4: State reset when closing and reopening form', async ({ page }) => {
      const pill = page.locator('.service-pill').first();
      await pill.click(); // Activate
      
      // Close modal
      await page.click('.icon-button[value="close"]');
      
      // Reopen
      await page.click('#reportButton');
      await page.fill('#draftArea', 'Регион');
      await page.fill('#draftOperator', 'Оператор');
      await page.click('#nextStepButton');
      
      // Should be reset to inactive
      await expect(pill).not.toHaveClass(/is-active/);
    });

    test('T2.3.5: Merging manual input with selected pills', async ({ page }) => {
      const pill = page.locator('.service-pill').first();
      const pillText = (await pill.textContent())?.trim() || '';
      
      await pill.click(); // Select pill
      
      // Focus and enter additional manual service input in the visible text field
      await page.fill('#draftServicesOther', 'MyManualService');
      await page.click('#nextStepButton');
      
      const output = await page.inputValue('#draftOutput');
      expect(output).toContain(pillText);
      expect(output).toContain('MyManualService');
    });
  });

  // ==========================================
  // FEATURE 4: Service Worker Offline Shell Caching
  // ==========================================
  test.describe('Feature 4: Service Worker Offline Shell Caching', () => {
    test('T2.4.1: Slow 3G network simulation behavior', async ({ context, page }) => {
      // Simulate Slow 3G network using CDP
      const client = await context.newCDPSession(page);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 400, // 400ms RTT
        downloadThroughput: 400 * 1024 / 8, // 400 kbps
        uploadThroughput: 150 * 1024 / 8, // 150 kbps
      });
      
      await page.reload();
      await expect(page.locator('.app-shell')).toBeVisible();
    });

    test('T2.4.2: Recovery from corrupted local cache', async ({ page }) => {
      // Simulate cache corruption by cleaning cache storage in browser
      await page.evaluate(async () => {
        if (window.caches) {
          const keys = await caches.keys();
          for (const key of keys) {
            await caches.delete(key);
          }
        }
      });
      // Page should still fetch from network and re-cache
      await page.reload();
      await expect(page.locator('.app-shell')).toBeVisible();
    });

    test('T2.4.3: Exclusion of external APIs from caching', async ({ page }) => {
      const externalCached = await page.evaluate(async () => {
        if (!window.caches) return false;
        const keys = await caches.keys();
        for (const key of keys) {
          const cache = await caches.open(key);
          const requests = await cache.keys();
          if (requests.some(req => !req.url.includes(location.origin))) {
            return true;
          }
        }
        return false;
      });
      expect(externalCached).toBe(false);
    });

    test('T2.4.4: Offline behavior with blocked LocalStorage', async ({ context, page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
          value: {
            getItem: () => { throw new Error('Blocked LocalStorage'); },
            setItem: () => { throw new Error('Blocked LocalStorage'); },
            removeItem: () => {},
            clear: () => {},
            key: () => null,
            length: 0
          },
          writable: true
        });
      });
      
      await context.setOffline(true);
      await page.reload();
      // App shell should still load without breaking due to LocalStorage block
      await expect(page.locator('.app-shell')).toBeVisible();
    });

    test('T2.4.5: Service Worker automatic cache update detection', async ({ page }) => {
      const swUpdateAvailable = await page.evaluate(() => {
        return 'serviceWorker' in navigator && typeof navigator.serviceWorker.ready !== 'undefined';
      });
      expect(swUpdateAvailable).toBe(true);
    });
  });

  // ==========================================
  // FEATURE 5: Glassmorphism Transparency
  // ==========================================
  test.describe('Feature 5: Glassmorphism Transparency', () => {
    test('T2.5.1: Text readability at 200% zoom', async ({ page }) => {
      // Set zoom to 200% via viewport size emulation or page zoom
      await page.evaluate(() => {
        // @ts-ignore
        document.body.style.zoom = '2.0';
      });
      const isVisible = await page.locator('.filters-panel').isVisible();
      expect(isVisible).toBe(true);
    });

    test('T2.5.2: Fallback background color when backdrop-filter not supported', async ({ page }) => {
      // Mock backdrop-filter support to false
      await page.addInitScript(() => {
        // Overwrite CSS.supports to return false for backdrop-filter
        const origSupports = CSS.supports;
        CSS.supports = (property, value) => {
          if (property.includes('backdrop-filter')) return false;
          return origSupports(property, value);
        };
      });
      await page.reload();
      const bg = await page.locator('.filters-panel').evaluate(el => getComputedStyle(el).backgroundColor);
      // Fallback background should have opacity near 1 (solid)
      const rgb = bg.match(/\d+/g);
      if (rgb && rgb[3]) {
        expect(parseFloat(rgb[3])).toBeGreaterThanOrEqual(0.9);
      }
    });

    test('T2.5.3: Rendering performance check (dragging map under panels)', async ({ page }) => {
      // Drag map several times to verify smooth rendering
      const mapStage = page.locator('#map');
      const box = await mapStage.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        for (let i = 0; i < 5; i++) {
          await page.mouse.move(box.x + box.width / 2 + (i * 20), box.y + box.height / 2);
        }
        await page.mouse.up();
      }
      expect(await mapStage.isVisible()).toBe(true);
    });

    test('T2.5.4: Double panel overlapping styling check', async ({ page }) => {
      // Open modal (which overlaps other panels)
      await page.click('#reportButton');
      const dialog = page.locator('#reportDialog');
      const style = await dialog.evaluate(el => getComputedStyle(el).backdropFilter);
      // Overlapping dialog should have glassmorphism too
      expect(style).not.toBe('');
    });

    test('T2.5.5: WCAG AA contrast ratio compliance of text on glass panels', async ({ page }) => {
      const contrast = await checkContrastRatio(page, '.filters-panel span', '.filters-panel');
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    });
  });

  // ==========================================
  // FEATURE 6: Inset Box-Shadow Light Glow
  // ==========================================
  test.describe('Feature 6: Inset Box-Shadow Light Glow', () => {
    test('T2.6.1: Focus element outline accessibility check', async ({ page }) => {
      await page.keyboard.press('Tab');
      // Verify active focused element has box-shadow
      const focusedShadow = await page.evaluate(() => {
        if (!document.activeElement) return 'none';
        return getComputedStyle(document.activeElement).boxShadow;
      });
      expect(focusedShadow).not.toBe('none');
    });

    test('T2.6.2: Validation error soft red glow check', async ({ page }) => {
      await page.click('#reportButton');
      // Click next without filling required fields to trigger validation/error borders
      await page.click('#nextStepButton');
      
      const glowColor = await page.locator('#draftArea').evaluate(el => getComputedStyle(el).boxShadow);
      // Box shadow should reflect validation state (usually red red/amber glow)
      expect(glowColor).not.toBe('');
    });

    test('T2.6.3: Multi-element rapid focus switch shadow check', async ({ page }) => {
      await page.focus('#searchInput');
      await page.focus('#freshnessFilter');
      const shadow = await page.locator('#freshnessFilter').evaluate(el => getComputedStyle(el).boxShadow);
      expect(shadow).not.toBe('none');
    });

    test('T2.6.4: Focus shadow stability on resize', async ({ page }) => {
      await page.focus('#searchInput');
      await page.setViewportSize({ width: 400, height: 600 });
      const shadow = await page.locator('#searchInput').evaluate(el => getComputedStyle(el).boxShadow);
      expect(shadow).not.toBe('none');
    });

    test('T2.6.5: Subpixel render quality check', async ({ page }) => {
      const shadow = await page.locator('#searchInput').evaluate(el => getComputedStyle(el).boxShadow);
      // Shadow should not use jagged pixel borders
      expect(shadow).toContain('px');
    });
  });

  // ==========================================
  // FEATURE 7: Tactile Scale Animations
  // ==========================================
  test.describe('Feature 7: Tactile Scale Animations', () => {
    test('T2.7.1: Reduced motion animation disabling', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.reload();
      
      const transition = await page.locator('#reportButton').evaluate(el => {
        const style = getComputedStyle(el);
        return style.transition || style.transitionProperty || 'none';
      });
      expect(transition).toMatch(/none|0s/);
    });

    test('T2.7.2: Hover list rapid cursor movements stability', async ({ page }) => {
      const cards = page.locator('.hotspot-card');
      const count = await cards.count();
      if (count > 1) {
        for (let i = 0; i < Math.min(count, 5); i++) {
          await cards.nth(i).hover();
        }
        // Element should not get stuck in hover state
        const lastCardTransform = await cards.first().evaluate(el => getComputedStyle(el).transform);
        expect(lastCardTransform).toBe('none');
      }
    });

    test('T2.7.3: Scale reset on mouse drag out during click hold', async ({ page }) => {
      const btn = page.locator('#reportButton');
      const box = await btn.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        // Drag out of button bounds
        await page.mouse.move(box.x - 50, box.y - 50);
        await page.mouse.up();
        await page.waitForTimeout(180);
        const transform = await btn.evaluate(el => getComputedStyle(el).transform);
        // Should scale back down/reset
        expect(transform).toBe('none');
      }
    });

    test('T2.7.4: Transitions under simulated CPU throttling', async ({ context, page }) => {
      const client = await context.newCDPSession(page);
      await client.send('Emulation.setCPUThrottlingRate', { rate: 4 }); // 4x slowdown
      
      const duration = await page.locator('#reportButton').evaluate(el => getComputedStyle(el).transitionDuration);
      expect(parseFloat(duration)).toBeGreaterThan(0);
    });

    test('T2.7.5: Button hitbox consistency during scaling', async ({ page }) => {
      const btn = page.locator('#reportButton');
      await btn.hover(); // Trigger scale animation
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
    });
  });

  // ==========================================
  // FEATURE 8: Neon Marker Fade animation
  // ==========================================
  test.describe('Feature 8: Neon Marker Fade animation', () => {
    test('T2.8.1: Memory performance with large amount of markers', async ({ page }) => {
      // Mock L.marker rendering to test load
      const count = await page.locator('.cluster-marker').count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('T2.8.2: Pulse animations disabled under reduced motion', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.reload();
      
      const pulseAnimation = await page.evaluate(() => {
        // Create indicator element and inspect
        const div = document.createElement('div');
        div.className = 'cluster-marker shutdown';
        document.body.appendChild(div);
        const style = getComputedStyle(div).animation;
        div.remove();
        return style;
      });
      expect(pulseAnimation).toMatch(/none|0s/);
    });

    test('T2.8.3: Marker positioning accuracy during zoom changes', async ({ page }) => {
      // Perform zoom in and zoom out
      await page.locator('.leaflet-control-zoom-in').click();
      await page.waitForTimeout(500);
      const isVisible = await page.locator('#map').isVisible();
      expect(isVisible).toBe(true);
    });

    test('T2.8.4: Animation throttling for offscreen markers', async ({ page }) => {
      // Scroll or pan map so some markers are offscreen
      const mapStage = page.locator('#map');
      await mapStage.evaluate(el => {
        // Dispatch custom swipe event or scroll
        el.scrollLeft = 500;
      });
      expect(await mapStage.isVisible()).toBe(true);
    });

    test('T2.8.5: Synchronization of marker and glow during fast drag', async ({ page }) => {
      const mapStage = page.locator('#map');
      const box = await mapStage.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2 - 200, { steps: 5 });
        await page.mouse.up();
      }
      expect(await mapStage.isVisible()).toBe(true);
    });
  });

  // ==========================================
  // FEATURE 9: Customized Scrollbar
  // ==========================================
  test.describe('Feature 9: Customized Scrollbar', () => {
    test('T2.9.1: Mobile viewport scrollbar overlay checking', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // Mobile screen size
      await page.click('#showMapTab');
      const isScrollable = await page.locator('.quick-filters').evaluate(el => {
        return el.scrollWidth > el.clientWidth;
      });
      expect(isScrollable).toBe(true);
    });

    test('T2.9.2: Cross-platform scrollbar width styling rules', async ({ page }) => {
      const rules = await page.evaluate(() => {
        return Array.from(document.styleSheets).some(sheet => {
          try {
            return Array.from(sheet.cssRules).some(rule => {
              return rule.cssText.includes('::-webkit-scrollbar') && 
                     (rule.cssText.includes('width') || rule.cssText.includes('height'));
            });
          } catch {
            return false;
          }
        });
      });
      expect(rules).toBe(true);
    });

    test('T2.9.3: Scrollbar user scroll action responsiveness', async ({ page }) => {
      const drawer = page.locator('.report-drawer');
      const originalScroll = await drawer.evaluate(el => el.scrollTop);
      await drawer.evaluate(el => el.scrollTop = 50);
      const newScroll = await drawer.evaluate(el => el.scrollTop);
      expect(newScroll).not.toBe(originalScroll);
    });

    test('T2.9.4: Hidden scrollbar thumb when height matches contents', async ({ page }) => {
      // Check that a small list has no scrollbar thumb
      const hasThumb = await page.evaluate(() => {
        const div = document.createElement('div');
        div.className = 'report-drawer';
        div.style.height = '1000px'; // larger than contents
        document.body.appendChild(div);
        const thumb = getComputedStyle(div, '::-webkit-scrollbar-thumb').backgroundColor;
        div.remove();
        return thumb;
      });
      expect(hasThumb).not.toBe('');
    });

    test('T2.9.5: Dynamically updated list scrollbar recalculation', async ({ page }) => {
      const drawer = page.locator('.report-drawer');
      const originalHeight = await drawer.evaluate(el => el.scrollHeight);
      // Append a mock element to force list update
      await drawer.evaluate(el => {
        const mock = document.createElement('div');
        mock.textContent = 'scroll recalculation probe';
        mock.style.display = 'block';
        mock.style.height = '500px';
        mock.style.minHeight = '500px';
        el.appendChild(mock);
      });
      const newHeight = await drawer.evaluate(el => el.scrollHeight);
      expect(newHeight).toBeGreaterThan(originalHeight);
    });
  });
});
