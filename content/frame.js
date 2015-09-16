/* globals addEventListener, addMessageListener, removeEventListener, removeMessageListener, sendAsyncMessage, content */

const { classes: Cc, interfaces: Ci } = Components;

let listener = {
	_events: [
		"AboutReaderContentLoaded"
	],
	_messages: [
		"BetterReader:disable",
		"BetterReader:prefs"
	],
	init: function() {
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
		case "AboutReaderContentLoaded":
			loaded();
			break;
		}
	},
	receiveMessage: function(message) {
		switch (message.name) {
		case "BetterReader:disable":
			this.destroy();
			break;
		case "BetterReader:prefs":
			if ("font" in message.data) {
				setFont(message.data.font, false);
			}
			if ("width" in message.data) {
				setWidth(message.data.width, false);
			}
			break;
		}
	}
};
listener.init();

function loaded() {
	if (!content || !isAboutReader()) {
		return;
	}

	let dropdown = content.document.getElementById("style-dropdown");
	let popup = content.document.getElementById("reader-popup");
	let before = content.document.getElementById("font-size-buttons");

	let div = content.document.createElement("div");
	div.id = "font-choice";

	let style = content.document.createElement("style");
	style.setAttribute("scoped", "");
	style.textContent = "@import url(\"chrome://betterreader/content/reader.css\");";
	div.appendChild(style);

	let select = content.document.createElement("select");
	let fontEnumerator = Cc["@mozilla.org/gfx/fontenumerator;1"].createInstance(Ci.nsIFontEnumerator);
	for (let f of fontEnumerator.EnumerateAllFonts({})) {
		let option = content.document.createElement("option");
		option.textContent = f;
		select.appendChild(option);
	}
	select.onchange = function() {
		if (dropdown.classList.contains("open")) {
			setFont(this.value);
		}
	};
	div.appendChild(select);

	popup.insertBefore(div, before);
	popup.insertBefore(content.document.createElement("hr"), before);

	before = content.document.getElementById("color-scheme-buttons");

	div = content.document.createElement("div");
	div.id = "container-width-buttons";

	style = style.cloneNode(true);
	div.appendChild(style);

	let button = content.document.createElement("button");
	button.className = "narrower-button";
	button.onclick = function() {
		changeWidth(-5);
	};
	div.appendChild(button);

	button = content.document.createElement("button");
	button.className = "wider-button";
	button.onclick = function() {
		changeWidth(5);
	};
	div.appendChild(button);

	popup.insertBefore(div, before);
	popup.insertBefore(content.document.createElement("hr"), before);

	sendAsyncMessage("BetterReader:getPrefs");
}

function isAboutReader() {
  if (!content) {
    return false;
  }
  return content.document.documentURI.startsWith("about:reader");
}

function setFont(font, setPref = true) {
	if (!isAboutReader) { return; }
	if (setPref) {
		sendAsyncMessage("BetterReader:setPref", { key: "font", value: font });
	}
	let container = content.document.getElementById("container");
	container.style.fontFamily = font;
}

function changeWidth(change) {
	let container = content.document.getElementById("container");
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
	if (!isAboutReader) { return; }
	if (setPref) {
		sendAsyncMessage("BetterReader:setPref", { key: "width", value: width });
	}
	let container = content.document.getElementById("container");
	container.style.maxWidth = width + "em";
}
