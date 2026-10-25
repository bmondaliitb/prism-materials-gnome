import GLib from 'gi://GLib';
import {memorySettings} from './settings.js';
import {initializeProfile, applyRecommended, applyStrength, applyDesktopProfile, DESKTOP_PROFILES, materialValues} from '../prism@local/simpleProfile.js';
import {SOFT_TINT} from '../prism@local/materials.js';
function assert(value, message) { if (!value) throw new Error(message); }
const settings = memorySettings();
const expectedKeys = ['appearance', 'auto-comfort', 'desktop-profile', 'enabled', 'material-strength',
    'reduce-transparency', 'simple-profile-version'];
assert(JSON.stringify(settings.settings_schema.list_keys().sort()) === JSON.stringify(expectedKeys.sort()),
    'The schema contains only the current UI choices, Custom strength and migration marker');
settings.set_boolean('enabled', false);
settings.set_boolean('reduce-transparency', true);
settings.set_string('appearance', 'dark');
initializeProfile(settings);
assert(settings.get_string('desktop-profile') === 'airy' && settings.get_int('material-strength') === 50,
    'Airy remains the fresh-install default');
assert(JSON.stringify(materialValues(50)) === JSON.stringify({windowOpacity:79,detail:14,popupOpacity:88,
    shellOpacity:76,panelOpacity:16,overviewOpacity:26}), 'Airy densities are unchanged');
const pixelDefaults = {opacity:0.79,detail:0.14,tint:SOFT_TINT,profiles:{}};
const opacity = {};
for (const id of Object.keys(DESKTOP_PROFILES)) {
    applyDesktopProfile(settings,id);
    const values=materialValues(settings.get_int('material-strength'));
    opacity[id]=values.windowOpacity;
    pixelDefaults.profiles[id]={opacity:values.windowOpacity/100,detail:values.detail/100};
    assert(settings.get_string('desktop-profile')===id, 'Preset selection persists');
    assert(!settings.get_boolean('enabled') && settings.get_boolean('reduce-transparency') &&
        settings.get_string('appearance')==='dark', 'Preset changes preserve accessibility, master and appearance');
}
const order=['mist','airy','balanced','subtle'];
assert(Object.keys(DESKTOP_PROFILES).length===4, 'Only four named presets remain');
for (const [id,strength] of [['glass',15],['crystal',0]]) {
    settings.set_int('simple-profile-version',5);
    settings.set_string('desktop-profile',id);
    settings.set_int('material-strength',strength);
    initializeProfile(settings);
    assert(settings.get_string('desktop-profile')==='custom' && settings.get_int('material-strength')===strength,
        'Retired presets migrate to Custom without changing their appearance');
}
for(let i=1;i<order.length;i++) assert(opacity[order[i-1]]<opacity[order[i]], 'Preset densities stay ordered');
settings.set_int('simple-profile-version',3);
settings.set_string('desktop-profile','macos');
settings.set_int('material-strength',50);
initializeProfile(settings);
assert(settings.get_string('desktop-profile')==='balanced' && materialValues(settings.get_int('material-strength')).windowOpacity===85,
    'Old named preset still migrates without its removed renderer settings');
settings.set_int('simple-profile-version',3);
settings.set_string('desktop-profile','custom');
settings.set_int('material-strength',42);
initializeProfile(settings);
assert(settings.get_int('material-strength')===64 && materialValues(64).windowOpacity===83, 'Old Custom density is rescaled safely');
settings.set_int('simple-profile-version',4);
applyStrength(settings,35);
initializeProfile(settings);
assert(settings.get_string('desktop-profile')==='custom' && settings.get_int('material-strength')===35,
    'Cleanup migration preserves an existing current selection and strength');
let previous=0;
for(let i=0;i<=100;i++) {
    applyStrength(settings,i);
    const values=materialValues(i);
    assert(values.windowOpacity>=previous && values.panelOpacity>=0 && values.detail>=0, 'Derived densities are monotonic and bounded');
    previous=values.windowOpacity;
}
assert(materialValues(0).windowOpacity===55 && materialValues(100).windowOpacity===95, 'Full Custom range is preserved');
applyRecommended(settings);
assert(settings.get_string('desktop-profile')==='airy' && !settings.get_boolean('enabled') &&
    settings.get_boolean('reduce-transparency'), 'Restore does not override master or accessibility');
GLib.file_set_contents('/tmp/prism-profile-default.json',JSON.stringify(pixelDefaults));
print('Minimal schema, unchanged preset densities, legacy migration, Custom range and preservation checks passed');
