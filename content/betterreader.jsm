/* exported BetterReader */
this.EXPORTED_SYMBOLS = ['BetterReader'];

/* globals Components, NetUtil, Preferences, Services */
const { utils: Cu } = Components;
Cu.import('resource://gre/modules/NetUtil.jsm');
Cu.import('resource://gre/modules/Preferences.jsm');
Cu.import('resource://gre/modules/Services.jsm');

let colourVars = new Map([
	['content.links', '#0095dd'],
	['controls.background', '#fbfbfb'],
	['controls.foreground', '#808080']
]);

switch (Preferences.get('reader.color_scheme')) {
case 'light':
	colourVars.set('content.foreground', '#333333');
	colourVars.set('content.background', '#ffffff');
	break;
case 'dark':
	colourVars.set('content.foreground', '#eeeeee');
	colourVars.set('content.background', '#333333');
	break;
case 'sepia':
	colourVars.set('content.foreground', '#5b4636');
	colourVars.set('content.background', '#f4ecd8');
	break;
}

const PREF_PREFIX = 'extensions.betterreader.';

var Presets = {
	PREF_HIDDEN_SHORT: 'css.presets.hidden',
	PREF_CUSTOM_SHORT: 'css.presets',
	PREF_HIDDEN: PREF_PREFIX + 'css.presets.hidden',
	PREF_CUSTOM: PREF_PREFIX + 'css.presets',
	_idCounter: 1,
	_map: null,
	_order: [],
	_hidden: [],
	get: function() {
		return new Promise(resolve => {
			if (this._map !== null) {
				resolve(this._getOrderedMap());
				return;
			}
			NetUtil.asyncFetch('chrome://betterreader/content/colours.json', stream => {
				let map = new Map();

				if (Preferences.has(Presets.PREF_CUSTOM)) {
					try {
						let prefPresets = JSON.parse(Preferences.get(Presets.PREF_CUSTOM));
						if (!Array.isArray(prefPresets)) {
							throw new Error('Error parsing presets');
						}
						for (let p of prefPresets) {
							map.set('_' + this._idCounter, p);
							this._order.push('_' + this._idCounter++);
						}
					} catch (ex) {
						Cu.reportError(ex);
					}
				}

				if (Preferences.has(Presets.PREF_HIDDEN)) {
					this._hidden = Preferences.get(Presets.PREF_HIDDEN).split(/\s+/);
				}
				let list = NetUtil.readInputStreamToString(stream, stream.available());
				list = JSON.parse(list.substring(list.indexOf('*/\n') + 3));
				for (let id in list) {
					if (list.hasOwnProperty(id)) {
						map.set(id, list[id]);
						this._order.push(id);
					}
				}

				this._map = map;
				resolve(this._getOrderedMap());
			});
		});
	},
	_getOrderedMap: function() {
		return [for (id of this._order) if (this._hidden.indexOf(id) < 0) [id, this._map.get(id)]];
	},
	add: function(values) {
		let id = '_' + this._idCounter++;
		this._map.set(id, values);
		this._order.unshift(id);
		this._saveCustom();
		return id;
	},
	_saveCustom: function() {
		let list = [for (id of this._order) if (id.startsWith('_')) this._map.get(id)];
		BetterReader.setPref(Presets.PREF_CUSTOM_SHORT, JSON.stringify(list));
	},
	remove: function(id) {
		let index = this._order.indexOf(id);
		if (index >= 0) {
			this._order.splice(index, 1);
		}
		this._map.delete(id);
		if (id.startsWith('_')) {
			this._saveCustom();
		} else {
			this._hidden.push(id);
			BetterReader.setPref(Presets.PREF_HIDDEN_SHORT, this._hidden.join(' '));
		}
	}
};

var BetterReader = {
	presets: Presets,
	getColourVariable: function(name) {
		name = name.replace(/^(\w+)-/, '$1.');
		if (name == 'controls.highlight') {
			let foreground = this.getColourVariable('controls.foreground');
			return this.toRGB(foreground, 0.25);
		}
		if (Preferences.has(PREF_PREFIX + 'css.' + name)) {
			return Preferences.get(PREF_PREFIX + 'css.' + name);
		}
		return colourVars.get(name);
	},
	setColourVariable: function(name, value) {
		name = 'css.' + name.replace(/^(\w+)-/, '$1.');
		this.setPref(name, value);
	},
	setPref: function(name, value) {
		if (Services.appinfo.processType == Services.appinfo.PROCESS_TYPE_CONTENT) {
			Services.cpmm.sendAsyncMessage('BetterReader:setPref', { name: name, value: value });
		} else {
			Preferences.set(PREF_PREFIX + name, value);
		}
	},
	toRGB: function(value, alpha = 255) {
		let match = /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(value);
		if (match) {
			let values = [for (v of match.slice(1)) parseInt(v, 16)];
			if (alpha != 255) {
				values.push(alpha);
				return 'rgba(' + values.join(', ') + ')';
			}
			return 'rgb(' + values.join(', ') + ')';
		}
		return value;
	},
	toHex: function(value) {
		let match = /^rgb\((\d+), *(\d+), *(\d+)(, *\d+)?\)$/.exec(value);
		if (match) {
			let [, r, g, b] = match;
			return '#' +
				(r < 16 ? '0' : '') + parseInt(r, 10).toString(16) +
				(g < 16 ? '0' : '') + parseInt(g, 10).toString(16) +
				(b < 16 ? '0' : '') + parseInt(b, 10).toString(16);
		}
		return value;
	}
};
