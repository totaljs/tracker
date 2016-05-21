const UPLOAD = { url: '', filename: '', width: 0, height: 0, size: 0 };

exports.install = function() {
	// READS
	F.route('/api/documents/{id}/',     json_read,              ['*Document', 'authorize']);
	F.route('/api/documents/{id}/',     json_delete,            ['*Document#backup', 'authorize', 'delete']);
	F.route('/api/issues/',             json_query,             ['authorize']);

	// SAVES
	F.route('/api/documents/comments/', json_save,              ['post', 'authorize', '*Comment']);
	F.route('/api/documents/issues/',   json_save,              ['post', 'authorize', '*Issue']);
	F.route('/api/documents/complete/', json_save,              ['post', 'authorize', '*IssueComplete']);
	F.route('/api/documents/',          json_save,              ['post', 'authorize', '*Document']);

	// UPLOADS
	F.route('/api/upload/',             json_upload,            ['upload', 'authorize'], 1024);
	F.route('/api/upload/photo/',       json_upload_photo,      ['upload', 'authorize'], 512);

	// USER
	F.route('/api/authorize/',          json_authorize,         ['unauthorize', 'post', '*User#form']);
	F.route('/api/authorize/confirm/',  json_authorize_confirm, ['unauthorize', 'post', '*User#confirm']);
	F.route('/api/profile/',            json_profile,           ['authorize']);
	F.route('/api/invite/',             json_invite,            ['authorize', 'post', '*Invite']);
};

function json_authorize() {
	var self = this;
	self.$workflow('exec', self, self.callback());
}

function json_authorize_confirm() {
	var self = this;
	self.$workflow('confirm', self, self.callback());
}

function json_profile() {
	var self = this;
	self.json(self.user);
}

function json_query() {
	var self = this;
	var async = [];
	var data = {};

	if (CONFIG('issues-according-hostname') && self.uri.hostname !== CONFIG('hostname'))
		self.query.hostname = self.uri.hostname;

	async.push(function(next) {
		GETSCHEMA('Document').query(self, function(err, response) {
			data.documents = response;
			next();
		});
	});

	async.push(function(next) {
		GETSCHEMA('Issue').query(self, function(err, response) {
			data.issues = response;
			next();
		});
	});

	async.async(() => self.json(data));
}

function json_read(uid) {
	var self = this;
	self.uid = uid;
	self.$read(self, self.callback());
}

function json_save() {
	var self = this;
	self.$save(self, self.callback());
}

function json_upload() {
	var self = this;
	var file = self.files[0];
	var extension = U.getExtension(file.filename);

	if (!extension) {
		switch (file.type) {
			case 'image/png':
				file.filename += '.png';
				break;
			case 'image/tiff':
				file.filename += '.tiff';
				break;
			case 'image/gif':
				file.filename += '.png';
				break;
			case 'image/jpeg':
				file.filename += '.png';
				break;
			case 'image/svg+xml':
				file.filename += '.svg';
				break;
		}
	}

	NOSQL('issues').binary.insert(file.filename, file.stream(), function(err, id) {
		UPLOAD.filename = file.filename;
		UPLOAD.url = '/upload/' + id + '.' + U.getExtension(file.filename);
		UPLOAD.width = file.width;
		UPLOAD.height = file.height;
		UPLOAD.size = file.length;
		self.json(UPLOAD);
	});
}

function json_upload_photo() {
	var self = this;
	var file = self.files[0];
	var email = self.body.email || '';

	if (!email.isEmail()) {
		self.invalid().push('error-email');
		return;
	}

	if (!file.isImage()) {
		self.invalid().push('error-filetype');
		return;
	}

	email = email.replace(/@|\./g, '_').toLowerCase() + '.jpg';

	file.image().make(function(filter) {
		filter.resizeAlign(100, 100, 'top', 'white');
		filter.quality(90);
		filter.output('jpg');
		filter.save(F.path.public('photos/' + email), (err) => self.callback()(err, SUCCESS(true)));
		F.touch('/photos/' + email);
	});
}

function json_delete(id) {
	var self = this;
	self.uid = id;
	self.$remove(self, self.callback());
}

function json_invite() {
	var self = this;
	self.$workflow('send', self, self.callback());
}