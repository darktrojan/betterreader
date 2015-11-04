/* exported BetterReader */
this.EXPORTED_SYMBOLS = ['BetterReader'];

/* globals Components, Preferences, Services */
Components.utils.import('resource://gre/modules/Preferences.jsm');
Components.utils.import('resource://gre/modules/Services.jsm');

let colourVars = new Map([
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

let BetterReader = {
	getColourVariable: function(name) {
		name = name.replace(/^(\w+)-/, '$1.');
		if (name == 'controls.button-hover') {
			let foreground = this.getColourVariable('controls.foreground');
			let [, r, g, b] = /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(foreground);
			return 'rgba(' + parseInt(r, 16) + ', ' + parseInt(g, 16) + ', ' + parseInt(b, 16) + ', 0.25)';
		}
		if (Preferences.has('extensions.betterreader.css.' + name)) {
			return Preferences.get('extensions.betterreader.css.' + name);
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
			Preferences.set('extensions.betterreader.' + name, value);
		}
	}
};
