exports.install = function() {
	F.route('/');
	F.route('/{id}/', 'index');
	F.file('/upload/*.*', file);
	F.file('/photos/*.jpg', photo);
};

function view_index() {
	var self = this;
	self.view('index');
}

function file(req, res) {
	var id = req.split[1];
	var index = id.lastIndexOf('.');

	NOSQL('issues').binary.read(id = id.substring(0, index), function(err, stream, header) {
		if (err)
			res.throw404();
		else
			res.stream(header.type, stream, header.name);
	});
}

function photo(req, res) {
	var id = req.split[2];
	var path = F.path.public(req.url.substring(1));
	F.path.exists(path, function(e) {
		if (e)
			res.file(path);
		else
			res.file(F.path.public('img/face.jpg'));
	});
}