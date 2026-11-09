import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('overlay polish', () => {
  it('puts Brightness on the pause card, so nobody quits to the title to see a zombie', () => {
    const pause = source('../src/components/PauseMenu.vue');
    expect(pause).toContain('<BrightnessSlider');
    expect(pause).toContain('id="pause"');
  });

  it('keeps Brightness in the Display card, and the Display card above Sound so a phone on its side shows it', () => {
    const options = source('../src/components/OptionsPage.vue');
    expect(options.indexOf('<DisplayOptions')).toBeGreaterThan(-1);
    expect(options.indexOf('<DisplayOptions')).toBeLessThan(options.indexOf('<SoundOptions'));
    const display = source('../src/components/DisplayOptions.vue');
    expect(display).toContain('<BrightnessSlider');
    expect(display.indexOf('<BrightnessSlider')).toBeLessThan(display.indexOf('<OptionChoice'));
  });

  it('follows the slider live, not only when a run loads', () => {
    const controller = source('../src/game/game-controller.ts');
    expect(controller).toContain('watch(brightness, () => this.renderer?.setBrightness(brightnessLift()))');
    expect(controller).toContain('this.stopBrightnessWatch();');
  });

  it('draws an empty candy bag where the cards would be', () => {
    const bag = source('../src/components/CandyBag.vue');
    expect(bag).toMatch(/<div v-else class="bag-empty/);
  });

  it('clears the level card, banners and callouts off the screen while a pause, map or bag overlay is up', () => {
    const app = source('../src/App.vue');
    expect(app).toContain('const overlayUp = computed(() => ui.value.paused || ui.value.mapOpen || ui.value.bagOpen);');
    for (const banner of ['<LevelCard', '<WaveBanner', '<KillCallout']) {
      const tag = app.slice(app.indexOf(banner), app.indexOf('/>', app.indexOf(banner)));
      expect(tag, banner).toContain('v-show="!overlayUp"');
    }
  });

  it('lays the HUD out like a Zelda screen: pickups top left, town and horde top centre, run numbers top right', () => {
    const hud = source('../src/components/HudOverlay.vue');
    expect(hud).toContain("grid-template-areas: 'vitals centre stack';");
    const top = hud.slice(hud.indexOf('<header class="hud-top">'), hud.indexOf('</header>'));
    expect(top.indexOf('hud-medkits')).toBeGreaterThan(-1);
    expect(top.indexOf('hud-medkits')).toBeLessThan(top.indexOf('hud-night'));
    expect(top.indexOf('hud-night')).toBeLessThan(top.indexOf('hud-health'));
    const foot = hud.slice(hud.indexOf('<footer class="hud-bottom">'), hud.indexOf('</footer>'));
    expect(foot).not.toContain('hud-medkits');
  });
});
