/* globals Components, addEventListener, addMessageListener,
	removeEventListener, removeMessageListener, content */
const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
const SVG_NS = 'http://www.w3.org/2000/svg';

/* globals NetUtil, Preferences, Services, XPCOMUtils, BetterReader */
Cu.import('resource://gre/modules/NetUtil.jsm');
Cu.import('resource://gre/modules/Preferences.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('chrome://betterreader/content/betterreader.jsm');

/* globals strings */
XPCOMUtils.defineLazyGetter(this, 'strings', function() {
	return Services.strings.createBundle(
		// Work around bug 918033.
		'chrome://betterreader/locale/strings.properties?' + Math.random()
	);
});

let listener = {
	_events: [
		'AboutReaderContentLoaded'
	],
	_messages: [
		'BetterReader:enable',
		'BetterReader:disable'
	],
	init: function() {
		addMessageListener('BetterReader:enable', this);
	},
	enable: function() {
		for (let e of this._events) {
			addEventListener(e, this, false, true);
		}
		for (let m of this._messages) {
			addMessageListener(m, this);
		}
	},
	destroy: function() {
		for (let e of this._events) {
			removeEventListener(e, this, false, true);
		}
		for (let m of this._messages) {
			removeMessageListener(m, this);
		}
	},
	handleEvent: function(event) {
		switch (event.type) {
		case 'AboutReaderContentLoaded':
			loaded();
			break;
		}
	},
	receiveMessage: function(message) {
		switch (message.name) {
		case 'BetterReader:enable':
			this.enable();
			break;
		case 'BetterReader:disable':
			this.destroy();
			break;
		}
	}
};
listener.init();

function loaded() {
	if (!content || !isAboutReader()) {
		return;
	}

	let varNames = [
		'content-background', 'content-foreground', 'content-links',
		'controls-background', 'controls-foreground', 'controls-highlight'
	];
	for (let v of varNames) {
		content.document.documentElement.style.setProperty('--' + v, BetterReader.getColourVariable(v));
	}
	varNames.pop(); // remove controls-highlight

	let style = content.document.createElement('style');
	style.setAttribute('scoped', '');
	style.textContent = '@import url("chrome://betterreader/content/content.css");';
	content.document.body.insertBefore(style, content.document.body.firstChild);

	let toolbar = content.document.getElementById('reader-toolbar');
	style = content.document.createElement('style');
	style.setAttribute('scoped', '');
	style.textContent = '@import url("chrome://betterreader/content/controls.css");';
	toolbar.insertBefore(style, toolbar.children[1]);

	let dropdown = content.document.getElementById('style-dropdown');
	let popup = content.document.getElementById('reader-popup');
	let before = content.document.getElementById('font-size-buttons');

	let fontTypeButtons = content.document.getElementById('font-type-buttons');
	fontTypeButtons.style.display = fontTypeButtons.nextElementSibling.style.display = 'none';

	let div = content.document.createElement('div');
	div.id = 'font-choice';

	let select = content.document.createElement('select');
	select.id = 'font-choice-select';
	let fontEnumerator = Cc['@mozilla.org/gfx/fontenumerator;1'].createInstance(Ci.nsIFontEnumerator);
	let fonts = [for (f of fontEnumerator.EnumerateAllFonts({})) f].sort(function(a, b) {
		return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
	});
	for (let f of fonts) {
		let option = content.document.createElement('option');
		option.textContent = f;
		select.appendChild(option);
	}
	select.onchange = function() {
		if (dropdown.classList.contains('open')) {
			setFont(this.value);
		}
	};
	div.appendChild(select);

	popup.insertBefore(div, before);
	popup.insertBefore(content.document.createElement('hr'), before);

	let button = content.document.getElementById('close-button');
	button.appendChild(createSVG(SVGPaths.closeButton));
	replaceSVG(dropdown.querySelector('.dropdown-toggle'));
	replaceSVG('font-size-minus');
	replaceSVG('font-size-plus');

	before = content.document.getElementById('color-scheme-buttons');

	let hasNewButtons = !!content.document.getElementById('content-width-minus');

	if (hasNewButtons) {
		replaceSVG('content-width-minus');
		replaceSVG('content-width-plus');

		replaceSVG('line-height-minus');
		replaceSVG('line-height-plus');
	} else {
		div = content.document.createElement('div');
		div.id = 'line-height-buttons';
		div.className = 'two-buttons';

		button = content.document.createElement('button');
		button.className = 'left-button';
		button.appendChild(createSVG(SVGPaths.lineHeightDownButton, 32));
		button.onclick = function() {
			changeLineHeight(-0.1);
		};
		div.appendChild(button);

		button = content.document.createElement('button');
		button.className = 'right-button';
		button.appendChild(createSVG(SVGPaths.lineHeightUpButton, 32));
		button.onclick = function() {
			changeLineHeight(0.1);
		};
		div.appendChild(button);

		popup.insertBefore(div, before);

		div = content.document.createElement('div');
		div.id = 'container-width-buttons';
		div.className = 'two-buttons';

		button = content.document.createElement('button');
		button.className = 'left-button';
		button.appendChild(createSVG(SVGPaths.narrowerButton, 32));
		button.onclick = function() {
			changeWidth(-5);
		};
		div.appendChild(button);

		button = content.document.createElement('button');
		button.className = 'right-button';
		button.appendChild(createSVG(SVGPaths.widerButton, 32));
		button.onclick = function() {
			changeWidth(5);
		};
		div.appendChild(button);

		popup.insertBefore(div, before);
		popup.insertBefore(content.document.createElement('hr'), before);
	}

	div = content.document.createElement('div');
	div.id = 'colour-choice-buttons';
	for (let v of varNames) {
		let innerDiv = content.document.createElement('div');
		innerDiv.classList.add('colourpicker');
		let stringName = strings.GetStringFromName('css.' + v.replace('-', '.'));
		let label = content.document.createElement('label');
		label.appendChild(content.document.createTextNode(stringName + ' '));
		innerDiv.appendChild(label);
		let input = content.document.createElement('input');
		input.type = 'color';
		input.name = v;
		input.value = BetterReader.toHex(BetterReader.getColourVariable(v));
		input.onchange = function() { // jshint ignore:line
			setColourVariable(this.name, this.value);
		};
		innerDiv.appendChild(input);
		div.appendChild(innerDiv);
	}
	popup.insertBefore(div, before);
	popup.insertBefore(content.document.createElement('hr'), before);

	let innerDiv = content.document.createElement('div');
	innerDiv.classList.add('colourpicker');
	innerDiv.appendChild(content.document.createElement('label'));
	button = content.document.createElement('button');
	let icon = createSVG(SVGPaths.presetSave, 21);
	icon.setAttribute('viewBox', '0 0 21 21');
	button.appendChild(icon);
	button.onclick = function() {
		let values = [for (i of div.querySelectorAll('input[type="color"]')) i.value];
		let id = BetterReader.presets.add(values);
		div.insertBefore(makePresetRow(id, values), div.querySelector('.preset'));
	};
	innerDiv.appendChild(button);
	div.appendChild(innerDiv);

	BetterReader.presets.get().then(function(presets) {
		for (let [id, p] of presets) {
			div.appendChild(makePresetRow(id, p));
		}
	});

	before.style.display = 'none';

	content.addEventListener('load', function load() {
		for (let arrow of toolbar.querySelectorAll('.dropdown-arrow')) {
			let arrowSVG = createSVG(SVGPaths.dropdownArrow);
			arrowSVG.querySelector('path').classList.add('foreground');
			let arrowFill = content.document.createElementNS(SVG_NS, 'path');
			arrowFill.setAttribute('d', 'M 16,21.585938 6.4160156,12 16,2.4160156 Z');
			arrowFill.classList.add('background');
			arrowSVG.appendChild(arrowFill);
			arrow.appendChild(arrowSVG);
		}

		content.removeEventListener('load', load);
		replaceSVG('narrate-toggle');
		replaceSVG('narrate-skip-previous');
		let startStopButton = content.document.getElementById('narrate-start-stop');
		replaceSVG(startStopButton, function() {
			startStopButton.firstChild.appendChild(createSVG(SVGPaths.stopButton).firstChild);
		});
		replaceSVG('narrate-skip-next');

		let narrateRow = content.document.getElementById('narrate-rate');
		if (narrateRow) {
			let slower = content.document.createElement('div');
			slower.style.backgroundImage = 'url("chrome://global/skin/narrate/slow.svg")';
			slower.style.backgroundSize = '24px';
			replaceSVG(slower, function() {
				slower.firstChild.setAttribute('width', '48');
			});
			narrateRow.insertBefore(slower, narrateRow.firstChild);
			let faster = content.document.createElement('div');
			faster.style.backgroundImage = 'url("chrome://global/skin/narrate/fast.svg")';
			faster.style.backgroundSize = '24px';
			replaceSVG(faster, function() {
				faster.firstChild.setAttribute('width', '48');
			});
			narrateRow.appendChild(faster);

			let downArrow = content.document.createElement('div');
			downArrow.style.backgroundImage = 'url("chrome://global/skin/narrate/arrow.svg")';
			downArrow.style.backgroundSize = '12px';
			replaceSVG(downArrow);
			content.document.querySelector('#voice-select > button').appendChild(downArrow);
		}

		replaceSVG('pocket-button');

		button = content.document.createElement('button');
		button.id = 'donate-button';
		button.className = 'button';
		button.title = strings.GetStringFromName('donate.label');
		button.appendChild(createSVG(SVGPaths.donateButton));
		button.onclick = function() {
			content.open('https://darktrojan.github.io/donate.html?betterreader');
		};
		let li = content.document.createElement('li');
		li.appendChild(button);
		toolbar.appendChild(li);
	});

	setFont(Preferences.get('extensions.betterreader.font'), false);
	if (!hasNewButtons) {
		setLineHeight(Preferences.get('extensions.betterreader.lineheight') / 10, false);
		setWidth(Preferences.get('extensions.betterreader.width'), false);
	}
}

function isAboutReader() {
	if (!content) {
		return false;
	}
	return content.document.documentURI.startsWith('about:reader');
}

function replaceSVG(button, callback) {
	if (typeof button == 'string') {
		button = content.document.getElementById(button);
	}
	if (!button) {
		return;
	}

	let cs = content.getComputedStyle(button);
	if (!cs.backgroundImage) {
		return;
	}
	let url = cs.backgroundImage.replace(/^url\(['"]/, '').replace(/['"]\)$/, '');
	let size = parseInt(cs.backgroundSize) || 24;

	try {
		NetUtil.asyncFetch(url, function(stream) {
			let svgText = NetUtil.readInputStreamToString(stream, stream.available());
			let svg = createSVG([], size);
			svg.setAttribute('viewBox', /viewBox="([\d\.\s]*)"/.exec(svgText)[1]);

			for (let e of ['path', 'rect']) {
				let start = svgText.indexOf('<' + e + ' ');
				while (start > 0) {
					let end = svgText.indexOf('/>', start);
					if (end < 0) {
						break;
					}
					let elementText = svgText.substring(start, end);
					let element = content.document.createElementNS(SVG_NS, e);
					for (let n of ['d', 'transform', 'x', 'y', 'width', 'height']) {
						let v = new RegExp('\\s' + n + '="([^"]*)"').exec(elementText);
						if (v && v[1]) {
							element.setAttribute(n, v[1]);
						}
					}
					svg.appendChild(element);
					start = svgText.indexOf('<' + e + ' ', end);
				}
			}

			button.appendChild(svg, size);
			button.style.backgroundImage = 'none';

			if (typeof callback == 'function') {
				callback();
			}
		});
	} catch (ex) {
		Components.utils.reportError(ex);
	}
}

function createSVG(pathD, size = 24) {
	let svg = content.document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('width', size);
	svg.setAttribute('height', size);
	if (!Array.isArray(pathD)) {
		pathD = [pathD];
	}
	for (let p of pathD) {
		let path = content.document.createElementNS(SVG_NS, 'path');
		path.setAttribute('d', p);
		svg.appendChild(path);
	}
	return svg;
}

function setFont(font, setPref = true) {
	if (!isAboutReader()) { return; }
	if (setPref) {
		BetterReader.setPref('font', font);
	} else {
		content.document.getElementById('font-choice-select').value = font;
	}
	let container = content.document.getElementById('container');
	container.style.fontFamily = font;
	content.document.getElementById('font-choice-select').style.fontFamily = font;
}

function changeLineHeight(change) {
	let container = content.document.getElementById('moz-reader-content');
	let currentLineHeight = parseFloat(container.style.lineHeight) || 1.6;
	let newLineHeight = currentLineHeight + change;

	if (newLineHeight > 2.5 || newLineHeight < 0.8) {
		return;
	}

	setLineHeight(newLineHeight);
}

function setLineHeight(lineHeight, setPref = true) {
	if (!isAboutReader()) { return; }
	if (setPref) {
		BetterReader.setPref('lineheight', lineHeight * 10);
	}
	let container = content.document.getElementById('moz-reader-content');
	container.style.lineHeight = lineHeight;
}

function changeWidth(change) {
	let container = content.document.getElementById('container');
	let style = content.getComputedStyle(container, null);
	let currentWidth = parseFloat(style.maxWidth, 10);
	let fontSize = parseFloat(style.fontSize, 10);
	let newWidth = (currentWidth / fontSize) + change;

	if (newWidth > 80 || newWidth < 20) {
		return;
	}

	setWidth(newWidth);
}

function setWidth(width, setPref = true) {
	if (!isAboutReader()) { return; }
	if (setPref) {
		BetterReader.setPref('width', width);
	}
	let container = content.document.getElementById('container');
	container.style.maxWidth = width + 'em';
}

function setColourVariable(name, value, setPref = true) {
	if (!isAboutReader()) { return; }

	value = BetterReader.toHex(value);

	if (setPref) {
		BetterReader.setColourVariable(name, value);
	}
	content.document.querySelector('input[type="color"][name="' + name + '"]').value = value;
	content.document.documentElement.style.setProperty('--' + name, value);
	if (name == 'controls-foreground') {
		content.document.documentElement.style.setProperty(
			'--controls-highlight',
			BetterReader.toRGB(value, 0.25)
		);
	}
}

function makePresetRow(id, p) {
	if (!Array.isArray(p) || p.length != 5) {
		return;
	}
	let row = content.document.createElement('div');
	row.classList.add('preset');
	row.dataset.id = id;
	for (let c of p) {
		let cell = content.document.createElement('div');
		cell.classList.add('swatch');
		cell.style.backgroundColor = c;
		row.appendChild(cell);
	}
	let button = content.document.createElement('button');
	let icon = createSVG(SVGPaths.presetRowRemove, 21);
	icon.setAttribute('viewBox', '0 0 21 21');
	button.appendChild(icon);

	row.appendChild(button);
	row.onclick = presetOnClick;
	return row;
}

function presetOnClick(event) {
	if (event.originalTarget.localName == 'button') {
		BetterReader.presets.remove(this.dataset.id);
		content.setTimeout(() => this.remove(), 100);
		return;
	}
	setColourVariable('content-background', this.children[0].style.backgroundColor);
	setColourVariable('content-foreground', this.children[1].style.backgroundColor);
	setColourVariable('content-links', this.children[2].style.backgroundColor);
	setColourVariable('controls-background', this.children[3].style.backgroundColor);
	setColourVariable('controls-foreground', this.children[4].style.backgroundColor);
}

var SVGPaths = {
	closeButton: 'M 18.184,8.87 H 9.698 V 4.011 L 1,11.981 9.698,19.95 v -4.82 h 8.486 z M 23,20' +
		' V 4 H 11.992 v 2.551 h 8.485 V 17.449 H 11.992 V 20 Z',
	lineHeightUpButton: 'M 0,5 v 2.4 h 16.8 v -2.4 Z M 0,10.8 v 2.4 h 16.8 v -2.4 Z M 0,16.6 v 2' +
		'.4 h 16.8 v -2.4 Z M 21.228124,5 18.457813,9.8 H 24 Z M 21.228124,19 18.457813,14.2 H ' +
		'24 Z',
	lineHeightDownButton: 'M 0,6 v 2.4 h 16.8 v -2.4 Z M 0,10.8 v 2.4 h 16.8 v -2.4 Z M 0,15.6 v' +
		' 2.4 h 16.8 v -2.4 Z M 21.228124,10.8 18.457813,6 H 24 Z M 21.228124,13.2 18.457813,18 ' +
		'H 24 Z',
	narrowerButton: 'M 9 4 L 9 11.134766 L 0 5.9375 L 0 18.0625 L 9 12.865234 L 9 20 L 11 20 L 1' +
		'1 4 L 9 4 z M 13 4 L 13 20 L 15 20 L 15 12.865234 L 24 18.0625 L 24 5.9375 L 15 11.1347' +
		'66 L 15 4 L 13 4 z',
	widerButton: 'M 0 4 L 0 20 L 2 20 L 2 12.865234 L 11 18.0625 L 11 5.9375 L 2 11.134766 L 2 4' +
		' L 0 4 z M 22 4 L 22 11.134766 L 13 5.9375 L 13 18.0625 L 22 12.865234 L 22 20 L 24 20 ' +
		'L 24 4 L 22 4 z',
	presetSave: 'm 10.5,2.1050272 1.973776,5.6783026 6.010318,0.1224812 -4.790457,3.631865 1.740' +
		'804,5.754 L 10.5,13.857989 l -4.9344414,3.433687 1.740804,-5.754 -4.7904561,-3.6318655 ' +
		'6.010317,-0.1224807 z',
	dropdownArrow: 'M 16 1.0019531 L 5 12 L 16 23 L 16 21.585938 L 6.4160156 12 L 16 2.4160156 L' +
		' 16 1.0019531 z',
	presetRowRemove: 'M 6.53125,5.46875 5.46875,6.53125 9.4375,10.5 5.46875,14.46875 6.53125,15.' +
		'53125 10.5,11.5625 l 3.96875,3.96875 1.0625,-1.0625 L 11.5625,10.5 15.53125,6.53125 14.' +
		'46875,5.46875 10.5,9.4375 Z',
	stopButton: 'm 3,2 h 18 c 0.554,0 1,0.446 1,1 v 18 c 0,0.554 -0.446,1 -1,1 H 3 C 2.446,22 2,' +
		'21.554 2,21 V 3 C 2,2.446 2.446,2 3,2 Z',
	donateButton: 'm 7.0852912,1.996204 q 2.7221988,0 4.2777408,3.1514212 0.563214,1.2471115 0.5' +
		'90034,1.9041725 h 0.04023 q 0.469344,-2.1723522 1.70305,-3.6073131 1.448263,-1.4482806 ' +
		'3.258593,-1.4482806 2.802658,0 4.492299,3.0038057 0.429115,1.1130902 0.429115,2.0920219' +
		' 0,3.3524534 -2.789248,6.3964924 l -7.09381,8.515291 h -0.08046 l -7.5363342,-9.2395 Q ' +
		'2.1236476,10.01537 2.1236476,7.0920316 q 0,-2.8295506 2.6685595,-4.4923201 Q 5.9186342,' +
		'1.996204 7.0852912,1.996204 Z'
};
