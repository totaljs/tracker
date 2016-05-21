COMPONENT('progress', function() {
	var self = this;
	var container;
	var old;

	self.readonly();

	self.make = function() {
		self.element.addClass('ui-progress');
		self.append('<div style="width:15%">0%</div>');
		container = self.find('div');
	};

	self.setter = function(value) {
		if (!value)
			value = 0;
		if (old === value)
			return;
		old = value;
		container.animate({ width: (old < 15 ? 15 : old) + '%' }, 100).html(old + '%');
	};
});

COMPONENT('contenteditable', function() {
	var self = this;
	var timers = {};
	var current = { bold: false, underline: false, italic: false, focused: false, node: null };
	var required = self.attr('data-required') === 'true';
	var placeholder = self.html();
	var isplaceholder = false;

	self.validate = function(value) {
		var type = typeof(value);

		if (type === 'undefined' || type === 'object')
			value = '';
		else
			value = value.toString();

		if (window.$calendar)
			window.$calendar.hide();

		value = value.replace(/\<br\>/g, '');
		return value.length > 0;
	};

	if (!required)
		self.noValid();

	self.destroy = function() {
		clearInterval(timers.changes);
		clearTimeout(timers.focused);
		clearTimeout(timers.selection);
	};

	self.make = function() {

		self.attr('contenteditable', 'true');
		self.element.addClass('ui-contenteditable');

		self.element.on('dragenter dragover', function(e) {
			e.preventDefault();
			e.stopPropagation();
		});

		self.element.on('drop', function(e) {
			e.stopPropagation();
			e.preventDefault();
			self.event('drop', e.originalEvent.dataTransfer.files);
		});

		self.element.on('selectstart', function() {
			clearTimeout(timers.selection);
			timers.selection = setTimeout(function() {
				self.event('select', self.getSelection());
			}, 500);
		});

		self.element.on('focus', function() {
			clearTimeout(timers.focused);
			clearInterval(timers.changes);

			if (isplaceholder) {
				isplaceholder = false;
				self.empty();
			}

			self.focused = true;
			self.event('focus', self);
			timers.changes = setInterval(function() {
				self.save();
			}, 1000);
		});

		self.element.on('blur', function() {
			clearTimeout(timers.focused);
			clearInterval(timers.changes);
			self.save();
			timers.focused = setTimeout(function() {
				self.event('blur', self);
				self.reset(true);

				if (placeholder && !self.html()) {
					isplaceholder = true;
					self.html(placeholder);
				}

			}, 200);
		});

		self.save = function() {
			if (isplaceholder)
				return;
			self.dirty(false);
			self.getter(self.html(), 2, true);
		};

		self.element.on('click', function(e) {
			if (e.target)
				self.event('click', e.target);
		});

		self.element.on('paste', function(e) {
			e.preventDefault();
			e.stopPropagation();

			var clipboard = e.originalEvent.clipboardData;
			var data = clipboard.items[0];
			if (data.type.indexOf('image') === -1) {
				var text = clipboard.getData(self.attr('data-clipboard') || 'text/plain');
				self.event('paste', text);
				return;
			}

			self.event('drop', [data.getAsFile()]);
		});

		self.element.on('keydown', function(e) {

			clearTimeout(timers.keypress);
			timers.keypress = setTimeout(function() {
				var node = self.getNode();
				if (node === self.element.get(0))
					node = undefined;
				if (current.node === node)
					return;
				current.node = node;
				self.event('current', node);
			}, 100);

			if (!e.metaKey && !e.ctrlKey)
				return;

			if (e.keyCode === 66) {
				// bold
				current.bold = !current.bold;
				document.execCommand('Bold', false, null);
				self.event('bold', current.bold);
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			if (e.keyCode === 76) {
				// link
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			if (e.keyCode === 73) {
				// italic
				current.italic = !current.italic;
				document.execCommand('Italic', false, null);
				self.event('italic', current.italic);
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			if (e.keyCode === 85) {
				// underline
				current.underline = !current.underline;
				document.execCommand('Underline', false, null);
				self.event('underline', current.underline);
				e.preventDefault();
				e.stopPropagation();
				return;
			}
		});
	};

	self.reset = function(blur) {
		var keys = Object.keys(current);
		for (var i = 0, length = keys.length; i < length; i++) {
			var key = keys[i];
			switch (key) {
				case 'focused':
					break;
				case 'node':
					current[key] = null;
					break;
				default:
					if (current[key] === false)
						break;
					current[key] = false;
					self.event(key, false);
					break;
			}
		}
	};

	self.exec = function() {
		self.element.focus();
		document.execCommand.apply(document, arguments);
		return self;
	};

	self.insert = function(value, encoded) {
		self.element.focus();
		document.execCommand(encoded ? 'insertText' : 'insertHtml', false, value);
		return self;
	};

	self.event = function(type, value) {

		// type = bold          - when a text is bolded (value is boolean)
		// type = italic        - when a text is italic (value is boolean)
		// type = underline     - when a text is underlined (value is boolean)
		// type = link          - when a link is created (value is a temporary URL)
		// type = current       - when a current element is changed in the text (value is NODE)
		// type = paste         - when the clipboard is used (value is a clipboard value)
		// type = select        - when a text is selected (value is selected text)
		// type = focus         - editor is focused (value is undefined)
		// type = blur          - editor is not focused (value is undefined)
		// type = click         - click on the specific element in the text (value is NODE)
		// type = drop          - drag & drop files

		if (type === 'paste')
			self.insert(value, true);

		if (type !== 'drop')
			return;

		var fd = new FormData();
		fd.append('file', value[0]);

		var loading = FIND('loading');

		if (loading)
			loading.show();

		UPLOAD('/api/upload/', fd, function(response, err) {

			if (loading)
				loading.hide(500);

			if (err) {
				var message = FIND('message');
				if (message)
					message.warning(self.attr('data-upload-error') || err.toString());
				else
					alert(self.attr('data-upload-error') || err.toString());
				return;
			}

			var index = response.url.lastIndexOf('.');
			var ext = response.url.substring(index + 1);
			switch (ext) {
				case 'png':
				case 'jpg':
				case 'jpeg':
				case 'tiff':
				case 'gif':
				case 'svg':
					self.insert('<a href="{0}" target="_blank"><img src="{0}" class="img-responsive" alt="{1}" border="0" /></a>'.format(response.url, response.filename));
					break;
				default:
					self.insert('<a href="{0}" target="_blank">{1} ({2} kB)</a>'.format(response.url, response.filename, (response.size / 1024) >> 0));
					break;
			}
		});
	};

	self.getNode = function() {
		var node = document.getSelection().anchorNode;
		if (node)
			return (node.nodeType === 3 ? node.parentNode : node);
	};

	self.getSelection = function() {
		if (document.selection && document.selection.type === 'Text')
			return document.selection.createRange().htmlText;
		else if (!window.getSelection)
			return;
		var sel = window.getSelection();
		if (!sel.rangeCount)
			return '';
		var container = document.createElement('div');
		for (var i = 0, len = sel.rangeCount; i < len; ++i)
			container.appendChild(sel.getRangeAt(i).cloneContents());
		return container.innerHTML;
	};

	self.setter = function(value, path, type) {
		if (type === 2)
			return;

		var html = value ? value.toString() : '';
		if (placeholder && !html) {
			isplaceholder = true;
			html = placeholder;
		}

		self.reset();
		self.html(html);
	};

	self.state = function(type, who) {
		if (!type)
			return;
		var invalid = self.isInvalid();
		if (invalid === self.$oldstate)
			return;
		self.$oldstate = invalid;
		self.element.toggleClass('ui-contenteditable-invalid', self.isInvalid());
	};
});

COMPONENT('validation', function() {

	var self = this;
	var path;
	var elements;

	self.readonly();

	self.make = function() {
		elements = self.find(self.attr('data-selector') || 'button');
		elements.prop({ disabled: true });
		self.evaluate = self.attr('data-if');
		path = self.path.replace(/\.\*$/, '');
		self.watch(self.path, self.state, true);
	};

	self.state = function() {
		var disabled = jC.disabled(path);
		if (!disabled && self.evaluate)
			disabled = !EVALUATE(self.path, self.evaluate);
		elements.prop({ disabled: disabled });
	};
});

COMPONENT('form', function() {

	var self = this;
	var autocenter;
	var focus;
	var refresh;
	var page = $('html');

	if (!MAN.$$form) {
		MAN.$$form = true;
		$(document).on('click', '.ui-form-button-close', function() {
			var com = $.components.findById($(this).attr('data-id'));
			SET(com.path, '');
			if (com.id !== 'forms.sender')
				location.hash = '';
		});
	}

	var hide = self.hide = function() {
		if (self.id !== 'forms.sender')
			location.hash = '';
		self.set('');
	};

	self.readonly();
	self.submit = function(hide) { self.hide(); };
	self.cancel = function(hide) { self.hide(); };
	self.title = function(value) {
		self.find('.ui-form-title-label').html(value);
	};

	self.make = function() {
		var content = self.element.html();
		var width = self.attr('data-width') || '800px';
		var submit = self.attr('data-submit');
		var enter = self.attr('data-enter');

		refresh = self.attr('data-refresh');
		focus = self.attr('data-focus');

		autocenter = self.attr('data-autocenter') !== 'false';
		self.condition = self.attr('data-if');
		self.element.empty();

		$(document.body).append('<div id="' + self._id + '" class="hidden ui-form-container"' + (self.attr('data-top') ? ' style="z-index:10"' : '') + '><div class="ui-form-container-padding"><div class="ui-form" style="max-width:' + width + '"><div class="ui-form-title"><span class="fa fa-times ui-form-button-close" data-id="' + self.id + '"></span><span class="ui-form-title-label">' + self.attr('data-title') + '</span></div>' + content + '</div></div>');

		self.element = $('#' + self._id);
		self.element.data(COM_ATTR, self);

		self.element.on('scroll', function() {
			if (window.$calendar)
				window.$calendar.hide();
		});

		self.element.find('button').on('click', function(e) {
			switch (this.name) {
				case 'submit':
					self.submit(hide);
					break;
				case 'cancel':
					if (!this.disabled)
						self[this.name](hide);
					break;
			}
		});

		if (enter === 'true') {
			self.element.on('keydown', 'input', function(e) {
				if (e.keyCode !== 13)
					return;
				var btn = self.element.find('button[name="submit"]');
				if (btn.get(0).disabled)
					return;
				self.submit(hide);
			});
		}

		return true;
	};

	self.resize = function() {
		if (!autocenter)
			return;
		var ui = self.find('.ui-form');
		var fh = ui.innerHeight();
		var wh = $(window).height();

		var r = (wh / 2) - (fh / 2);
		if (r > 20)
			ui.css({ marginTop: (r - 15) + 'px' });
		else
			ui.css({ marginTop: '20px' });
	};

	self.getter = null;
	self.setter = function(value) {

		var isHidden = !EVALUATE(self.path, self.condition);
		self.element.toggleClass('hidden', isHidden);

		if (window.$calendar)
			window.$calendar.hide();

		page.removeClass('noscroll');

		if (!isHidden) {

			setTimeout(self.resize, 500);

			if (focus && !isMOBILE) {
				setTimeout(function() {
					self.element.find(focus).focus();
				}, 1000);
			}

			var fn = refresh;
			if (fn)
				GET(fn)();

			page.addClass('noscroll');
			self.element.animate({ scrollTop: 0 }, 0, function() {
				setTimeout(function() {
					self.element.find('.ui-form').addClass('ui-form-animate');
				}, 300);
			});

		} else
			self.element.find('.ui-form').removeClass('ui-form-animate');
	};
});
/**
 * Textbox
 * @version 2.0.0
 */
COMPONENT('textbox', function() {

	var self = this;
	var required = self.attr('data-required') === 'true';
	var input;
	var container;

	self.validate = function(value) {

		if (input.prop('disabled'))
			return true;

		var type = typeof(value);

		if (type === 'undefined' || type === 'object')
			value = '';
		else
			value = value.toString();

		if (window.$calendar)
			window.$calendar.hide();

		if (self.type === 'email')
			return value.isEmail();
		if (self.type === 'currency')
			return value > 0;
		if (self.type === 'url')
			return value.isURL();

		return value.length > 0;
	};

	if (!required)
		self.noValid();

	self.make = function() {

		var attrs = [];
		var builder = [];
		var tmp;

		attrs.attr('type', self.type === 'password' ? self.type : 'text');
		attrs.attr('placeholder', self.attr('data-placeholder'));
		attrs.attr('maxlength', self.attr('data-maxlength'));
		attrs.attr('data-component-keypress', self.attr('data-component-keypress'));
		attrs.attr('data-component-keypress-delay', self.attr('data-component-keypress-delay'));
		attrs.attr('data-component-bind', '');

		tmp = self.attr('data-align');
		if (tmp)
			attrs.attr('class', 'ui-' + tmp);

		if (self.attr('data-autofocus') === 'true')
			attrs.attr('autofocus');

		var content = self.html();
		var icon = self.attr('data-icon');
		var icon2 = self.attr('data-control-icon');
		var increment = self.attr('data-increment') === 'true';

		if (!icon2 && self.type === 'date')
			icon2 = 'fa-calendar';

		builder.push('<input {0} />'.format(attrs.join(' ')));

		if (icon2)
			builder.push('<div><span class="fa {0}"></span></div>'.format(icon2));
		else if (increment)
			builder.push('<div><span class="fa fa-caret-up"></span><span class="fa fa-caret-down"></span></div>');

		if (increment) {
			self.element.on('click', '.fa-caret-up,.fa-caret-down', function(e) {
				var el = $(this);
				var inc = -1;
				if (el.hasClass('fa-caret-up'))
					inc = 1;
				self.change(true);
				self.inc(inc);
			});
		}

		if (self.type === 'date') {
			self.element.on('click', '.fa-calendar', function(e) {
				e.preventDefault();
				if (!window.$calendar)
					return;
				var el = $(this);
				window.$calendar.toggle(el.parent().parent(), self.element.find('input').val(), function(date) {
					self.set(date);
				});
			});
		}

		if (!content.length) {
			self.element.addClass('ui-textbox ui-textbox-container');
			self.html(builder.join(''));
			input = self.find('input');
			container = self.find('.ui-textbox');
			return;
		}

		var html = builder.join('');
		builder = [];
		builder.push('<div class="ui-textbox-label{0}">'.format(required ? ' ui-textbox-label-required' : ''));

		if (icon)
			builder.push('<span class="fa {0}"></span> '.format(icon));

		builder.push(content);
		builder.push(':</div><div class="ui-textbox">{0}</div>'.format(html));

		self.html(builder.join(''));
		self.element.addClass('ui-textbox-container');
		input = self.find('input');
		container = self.find('.ui-textbox');
	};

	self.state = function(type, who) {
		if (!type)
			return;
		var invalid = self.isInvalid();
		if (invalid === self.$oldstate)
			return;
		self.$oldstate = invalid;
		container.toggleClass('ui-textbox-invalid', self.isInvalid());
	};
});

/**
 * Validator
 * @version 2.0.0
 */
COMPONENT('validation', function() {

	var self = this;
	var path;
	var elements;

	self.readonly();

	self.make = function() {
		elements = self.find(self.attr('data-selector') || 'button');
		elements.prop({ disabled: true });
		self.evaluate = self.attr('data-if');
		path = self.path.replace(/\.\*$/, '');
		self.watch(self.path, self.state, true);
	};

	self.state = function() {
		var disabled = jC.disabled(path);
		if (!disabled && self.evaluate)
			disabled = !EVALUATE(self.path, self.evaluate);
		elements.prop({ disabled: disabled });
	};
});

/**
 * Error
 * @version 2.0.0
 */
COMPONENT('error', function() {
	var self = this;

	self.readonly();

	self.make = function() {
		self.element.addClass('ui-error hidden');
	};

	self.setter = function(value) {

		if (!(value instanceof Array) || !value.length) {
			self.element.addClass('hidden');
			return;
		}

		var builder = [];
		for (var i = 0, length = value.length; i < length; i++)
			builder.push('<div><span class="fa fa-times-circle"></span>{0}</div>'.format(value[i].error));

		self.html(builder.join(''));
		self.element.removeClass('hidden');
	};
});

COMPONENT('loading', function() {
	var self = this;
	var pointer;

	self.readonly();
	self.singleton();

	self.make = function() {
		self.element.addClass('ui-loading');
	};

	self.show = function() {
		clearTimeout(pointer);
		self.element.toggleClass('hidden', false);
		return self;
	};

	self.hide = function(timeout) {
		clearTimeout(pointer);
		pointer = setTimeout(function() {
			self.element.toggleClass('hidden', true);
		}, timeout || 1);
		return self;
	};
});

/**
 * Confirm Message
 * @version 1.0.0
 */
COMPONENT('confirm', function() {
	var self = this;
	var is = false;
	var visible = false;
	var timer;

	self.readonly();
	self.singleton();

	self.make = function() {
		self.element.addClass('ui-confirm hidden');
		self.element.on('click', 'button', function() {
			self.hide($(this).attr('data-index').parseInt());
		});
	};

	self.confirm = function(message, buttons, fn) {
		self.callback = fn;

		var builder = [];

		buttons.forEach(function(item, index) {
			builder.push('<button data-index="{1}">{0}</button>'.format(item, index));
		});

		self.content('ui-confirm-warning', '<div class="ui-confirm-message">{0}</div>{1}'.format(message.replace(/\n/g, '<br />'), builder.join('')));
	};

	self.hide = function(index) {

		if (self.callback)
			self.callback(index);

		self.element.removeClass('ui-confirm-visible');
		if (timer)
			clearTimeout(timer);
		timer = setTimeout(function() {
			visible = false;
			self.element.addClass('hidden');
		}, 1000);
	};

	self.content = function(cls, text) {

		if (!is)
			self.html('<div><div class="ui-confirm-body"></div></div>');

		if (timer)
			clearTimeout(timer);

		visible = true;
		self.element.find('.ui-confirm-body').empty().append(text);
		self.element.removeClass('hidden');
		setTimeout(function() {
			self.element.addClass('ui-confirm-visible');
		}, 5);
	};
});

/**
 * Message
 * @version 1.0.0
 */
COMPONENT('message', function() {
	var self = this;
	var is = false;
	var visible = false;
	var timer;

	self.readonly();
	self.singleton();

	self.make = function() {
		self.element.addClass('ui-message hidden');

		self.element.on('click', 'button', function() {
			self.hide();
		});

		$(window).on('keyup', function(e) {
			if (!visible)
				return;
			if (e.keyCode === 27)
				self.hide();
		});
	};

	self.warning = function(message, icon, fn) {
		if (typeof(icon) === 'function') {
			fn = icon;
			icon = undefined;
		}
		self.callback = fn;
		self.content('ui-message-warning', message, icon || 'fa-warning');
	};

	self.success = function(message, icon, fn) {

		if (typeof(icon) === 'function') {
			fn = icon;
			icon = undefined;
		}

		self.callback = fn;
		self.content('ui-message-success', message, icon || 'fa-check-circle');
	};

	self.hide = function() {

		if (self.callback)
			self.callback();

		self.element.removeClass('ui-message-visible');
		if (timer)
			clearTimeout(timer);
		timer = setTimeout(function() {
			visible = false;
			self.element.addClass('hidden');
		}, 1000);
	};

	self.content = function(cls, text, icon) {

		if (!is)
			self.html('<div><div class="ui-message-body"><span class="fa fa-warning"></span><div class="ui-center"></div></div><button>' + (self.attr('data-button') || 'Close') + '</button></div>');

		if (timer)
			clearTimeout(timer);

		visible = true;
		self.element.find('.ui-message-body').removeClass().addClass('ui-message-body ' + cls);
		self.element.find('.fa').removeClass().addClass('fa ' + icon);
		self.element.find('.ui-center').html(text);
		self.element.removeClass('hidden');
		setTimeout(function() {
			self.element.addClass('ui-message-visible');
		}, 5);
	};
});

COMPONENT('click', function() {
	var self = this;

	self.readonly();

	self.click = function() {

		if (self.element[0].tagName === 'A') {
			if (self.element.hasClass('disabled'))
				return;
			if (self.element.parent().hasClass('disabled'))
				return;
		}

		var value = self.attr('data-value');
		if (typeof(value) === 'string')
			self.set(self.parser(value));
		else
			self.get(self.attr('data-component-path'))(self);
	};

	self.make = function() {

		self.element.on('click', self.click);

		var enter = self.attr('data-enter');
		if (!enter)
			return;

		$(enter).on('keydown', 'input', function(e) {
			if (e.keyCode !== 13)
				return;
			setTimeout(function() {
				if (self.element.get(0).disabled)
					return;
				self.click();
			}, 100);
		});
	};
});

COMPONENT('visible', function() {
	var self = this;
	var condition = self.attr('data-if');
	self.readonly();
	self.setter = function(value) {

		var is = true;

		if (condition)
			is = EVALUATE(self.path, condition);
		else
			is = value ? true : false;

		self.element.toggleClass('hidden', !is);
	};
});

/**
 * Dropdown
 * @version 2.0.0
 */
COMPONENT('dropdown', function() {

	var self = this;
	var required = self.attr('data-required') === 'true';
	var select;
	var container;

	self.validate = function(value) {

		var type = typeof(value);

		if (select.prop('disabled'))
			return true;

		if (type === 'undefined' || type === 'object')
			value = '';
		else
			value = value.toString();

		if (window.$calendar)
			window.$calendar.hide();

		if (self.type === 'currency' || self.type === 'number')
			return value > 0;

		return value.length > 0;
	};

	if (!required)
		self.noValid();

	self.render = function(arr) {

		var builder = [];
		var value = self.get();
		var template = '<option value="{0}"{1}>{2}</option>';
		var propText = self.attr('data-source-text') || 'name';
		var propValue = self.attr('data-source-value') || 'id';
		var emptyText = self.attr('data-empty');

		if (emptyText !== undefined)
			builder.push('<option value="">{0}</option>'.format(emptyText));

		for (var i = 0, length = arr.length; i < length; i++) {
			var item = arr[i];
			if (item.length)
				builder.push(template.format(item, value === item ? ' selected="selected"' : '', item));
			else
				builder.push(template.format(item[propValue], value === item[propValue] ? ' selected="selected"' : '', item[propText]));
		}

		select.html(builder.join(''));
	};

	self.make = function() {

		var options = [];

		(self.attr('data-options') || '').split(';').forEach(function(item) {
			item = item.split('|');
			options.push('<option value="{0}">{1}</option>'.format(item[1] === undefined ? item[0] : item[1], item[0]));
		});

		self.element.addClass('ui-dropdown-container');

		var label = self.html();
		var html = '<div class="ui-dropdown"><span class="fa fa-sort"></span><select data-component-bind="">{0}</select></div>'.format(options.join(''));
		var builder = [];

		if (label.length) {
			var icon = self.attr('data-icon');
			builder.push('<div class="ui-dropdown-label{0}">{1}{2}:</div>'.format(required ? ' ui-dropdown-label-required' : '', icon ? '<span class="fa {0}"></span> '.format(icon) : '', label));
			builder.push('<div class="ui-dropdown-values">{0}</div>'.format(html));
			self.html(builder.join(''));
		} else
			self.html(html).addClass('ui-dropdown-values');

		select = self.find('select');
		container = self.find('.ui-dropdown');

		var ds = self.attr('data-source');
		if (!ds)
			return;

		var prerender = function(path) {
			var value = self.get(self.attr('data-source'));
			if (NOTMODIFIED(self.id, value))
				return;
			if (!value)
				value = [];
			self.render(value);
		};

		self.watch(ds, prerender, true);
	};

	self.state = function(type, who) {
		if (!type)
			return;
		var invalid = self.isInvalid();
		if (invalid === self.$oldstate)
			return;
		self.$oldstate = invalid;
		container.toggleClass('ui-dropdown-invalid', self.isInvalid());
	};
});

COMPONENT('template', function() {
	var self = this;
	self.readonly();
	self.make = function(template) {

		if (template) {
			self.template = Tangular.compile(template);
			return;
		}

		var script = self.element.find('script');

		if (!script.length) {
			script = self.element;
			self.element = self.element.parent();
		}

		self.template = Tangular.compile(script.html());
		script.remove();
	};

	self.setter = function(value) {
		if (NOTMODIFIED(self.id, value))
			return;
		if (!value)
			return self.element.addClass('hidden');
		KEYPRESS(function() {
			self.html(self.template(value)).removeClass('hidden');
			COMPILE(100);
		}, 100, self.id);
	};
});

COMPONENT('repeater', function() {

	var self = this;
	var recompile = false;

	self.readonly();

	self.make = function() {
		var element = self.element.find('script');
		var html = element.html();
		element.remove();
		self.template = Tangular.compile(html);
		recompile = html.indexOf('data-component="') !== -1;
	};

	self.setter = function(value) {

		if (!value || !value.length) {
			self.empty();
			return;
		}

		var builder = [];
		for (var i = 0, length = value.length; i < length; i++) {
			var item = value[i];
			item.index = i;
			builder.push(self.template(item).replace(/\$index/g, i.toString()).replace(/\$/g, self.path + '[' + i + ']'));
		}

		self.html(builder);

		if (recompile)
		   jC.compile();
	};
});

COMPONENT('tracker-issues', function() {
	var self = this;
	var Tdetail;
	var Tcomment;

	self.readonly();

	self.make = function() {
		self.find('script').each(function(index) {
			switch (index) {
				case 0:
					Tdetail = Tangular.compile(this.innerHTML);
					break;
				case 1:
					Tcomment = Tangular.compile(this.innerHTML);
					break;
			}
		}).remove();

		self.element.on('click', '.document-button-minimize', function() {
			var button = $(this);
			button.parent().toggleClass('document-comment-minimized');
			button.find('.fa').toggleClass('fa-compress fa-expand');
		});

		self.element.on('click', '.document-button-complete', function() {

			var button = $(this);
			var id = button.attr('data-issue');

			if (BLOCKED('complete' + id, 2000))
				return;

			button.toggleClass('document-button-completed');
			var is = button.hasClass('document-button-completed');

			var issue = self.get().findItem('id', id);
			if (issue)
				issue.iscompleted = is;

			var members = [];

			issue.comments.forEach(function(item) {
				if (item.email === user.email)
					return;
				if (members.indexOf(item.email) === -1)
					members.push(item.email);
			});

			AJAX('POST /api/documents/complete/', { id: id, iscompleted: is, email: user.email, members: members, iddocument: issue.iddocument, name: issue.name });
			SETTER('tracker-bookmarks', 'refresh');
			SETTER('tracker-percentage', 'refresh');
			SETTER('tracker-changes', 'refresh');
			button.closest('.document-container').toggleClass('document-completed', is);
		});
	};

	self.comment = function(id, comment) {
		comment.visible = true;
		self.element.find('[data-issue="{0}"]'.format(id)).find('.document-comments').append(Tcomment(comment, user));
		SETTER('tracker-changes', 'refresh');
		return self;
	};

	self.push = function(issue) {
		self.append(Tdetail(issue, user));
		SETTER('tracker-bookmarks', 'refresh');
		SETTER('tracker-percentage', 'refresh');
		return self;
	};

	self.setter = function(value) {

		if (!value) {
			self.empty();
			return;
		}

		var builder = [];
		for (var i = 0, length = value.length; i < length; i++) {

			var tmp = [];
			var item = value[i];
			var count = item.comments.length;

			item.index = i;
			item.comments.forEach(function(comment, index) {
				comment.index = index;
				comment.visible = !index || index > count - 3;
				comment.owner = item.email;
				comment.iscompleted = item.iscompleted;
				tmp.push(Tcomment(comment, user));
			});

			item.body = tmp.join('');
			builder.push(Tdetail(item, user));
		}

		self.html(builder);
		COMPILE();
	};
});

COMPONENT('tracker-bookmarks', function() {
	var self = this;

	self.template = Tangular.compile('<div><a href="#issue{{ id }}" data-issue="{{ id }}" class="tracker-bookmark{{ if iscompleted }} completed{{ fi }}"><i class="fa fa-bo"></i>{{ name }}</a></div>');
	self.readonly();

	self.complete = function(id, is) {
		self.find('[data-issue="{0}"]'.format(id)).toggleClass('completed', is);
	};

	self.scroll = function(id) {
		var el = $('.document-container[data-issue="{0}"]'.format(id));
		if (!el.length)
			return;
		var top = el.offset().top;
		$('document,body').animate({ scrollTop: top });
	};

	self.make = function() {
		self.element.addClass('tracker-bookmark');
		self.element.on('click', 'a', function(e) {
			e.preventDefault();
			e.stopPropagation();
			self.scroll($(this).attr('data-issue'));
		});
	};

	self.setter = function(value) {
		if (!value)
			return;

		var builder = [];

		value.forEach(function(item) {
			builder.push(self.template(item));
		});

		self.html(builder);
	};
});

COMPONENT('tracker-percentage', function() {
	var self = this;
	self.readonly();

	self.make = function() {
		self.element.addClass('tracker-percentage');
	};

	self.setter = function(value) {

		if (!value) {
			self.empty();
			return;
		}

		var count = 0;

		value.forEach(function(item) {
			if (item.iscompleted)
				count++;
		});

		count = Math.round((count / value.length) * 100);
		self.toggle(count > 20);
		self.html('<div class="percentage" style="width:{0}%">{0}%</div>'.format(count));
	};
});

COMPONENT('tracker-changes', function() {
	var self = this;
	self.readonly();
	self.template = Tangular.compile('<div class="change" data-comment="{{ id }}"><div class="photo"><img src="{{ email | photo }}" border="0" alt="{{ email }}" height="50" /></div><div class="body"><div class="name">{{ name }}</div><div class="email">{{ email }}</div><div class="created">{{ created | format(\'{0}\') }}</div></div></div>'.format(self.attr('data-dateformat')));

	self.make = function() {
		self.element.addClass('tracker-changes');
		self.element.on('click', '.change', function() {
			var id = $(this).attr('data-comment');
			var top = $('.document-comment[data-comment="{0}"]'.format(id)).offset().top;
			$('document,body').animate({ scrollTop: top }, 300);
		});
	};

	self.setter = function(value) {

		if (!value) {
			self.toggle('hidden', true);
			return;
		}

		var builder = ['<div class="caption"><i class="fa fa-comments"></i>' + self.attr('data-caption') + '</div>'];
		var counter = 0;

		value.forEach(function(item) {
			if (item.iscompleted)
				return;
			var comment = item.comments[item.comments.length - 1];
			if (!comment || comment.email === user.email)
				return;
			builder.push(self.template({ id: comment.id, name: item.name, email: comment.email, created: comment.created }));
			counter++;
		});

		if (!counter) {
			self.toggle('hidden', true);
			return;
		}

		self.toggle('hidden', false);
		self.html(builder);
	};
});

COMPONENT('tracker-members', function() {
	var self = this;
	self.template = Tangular.compile('<div class="col-xs-6"><img src="{{ email | photo }}" /></div>');
	self.readonly();
	self.setter = function(value) {
	};
});

COMPONENT('photoupload', function() {

	var self = this;
	var input;
	self.readonly();

	self.make = function() {
		var id = 'photoupload' + self.id;

		$(document.body).append('<input type="file" id="{0}" class="hidden" accept="image/*" />'.format(id));

		input = $('#' + id);

		self.element.on('click', function() {
			input.click();
		});

		input.on('change', function(evt) {

			var files = evt.target.files;
			var data = new FormData();
			var el = this;

			data.append('email', self.get());

			for (var i = 0, length = files.length; i < length; i++)
				data.append('file' + i, files[i]);

			var loading = FIND('loading');

			if (loading)
				loading.show();

			jC.UPLOAD(self.attr('data-url'), data, function(response, err) {

				if (loading)
					loading.hide(500);

				if (err) {
					var message = FIND('message');
					if (message)
						message.warning(self.attr('data-upload-error') || err.toString());
					else
						alert(self.attr('data-upload-error') || err.toString());
					return;
				}

				self.find('img').attr('src', Tangular.helpers.photo(user.email) + '?ts=' + Date.now());
				el.value = '';
			});
		});
	};
});

COMPONENT('toggleclass', function() {
	var self = this;
	self.readonly();
	self.setter = function(value) {
		self.toggle(self.attr('data-class'), EVALUATE(self.path, self.attr('data-if')));
	};
});

COMPONENT('empty', function() {

	var self = this;

	self.readonly();

	self.make = function() {
		self.element.addClass('ui-empty');
	};

	self.setter = function(value) {
		self.element.toggleClass('hidden', value && value.length ? true : false);
	};
});
