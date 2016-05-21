const COOKIE = '_utracker';
const SECRET = 'TrACKER';
const PIN = {};

// Can prevent cleaning created PIN
var CLEAN = true;

F.onAuthorize = function(req, res, flags, callback) {
	var cookie = req.cookie(COOKIE);
	if (!cookie)
		return callback(false);

	var obj = F.decrypt(cookie, SECRET);
	if (!obj)
		return callback(false);

	if (obj.expire < F.datetime.getTime())
		return callback(false);

	callback(true, obj);
};

NEWSCHEMA('User').make(function(schema) {

	schema.define('email', 'Email', true, 'form');
	schema.define('pin', 'Upper(4)', true, 'confirm');

	schema.addWorkflow('exec', function(error, model, controller, callback) {

		var members = CONFIG('members-allowed');

		if (members && members !== '*' && members.indexOf(model.email.toLowerCase()) === -1) {
			error.push('error-member');
			return callback();
		}

		model.pin = U.GUID(4).toUpperCase();
		PIN[model.pin] = model;

		// Extends clearing of PINs about 5 minutes
		CLEAN = false;

		F.mailmembers([model.email], '@(Tracker authorization)', 'pin', model, controller.language);
		callback(SUCCESS(true));
	});

	schema.addWorkflow('confirm', function(error, model, controller, callback) {
		model = PIN[model.pin];

		if (model) {
			controller.res.cookie(COOKIE, F.encrypt({ email: model.email, expire: new Date().add('1 month').getTime() }, SECRET), '1 month');
			return callback(SUCCESS(true));
		}

		error.push('error-pin');
		callback();
	});
});

F.on('service', function(counter) {
	if (counter % 5 !== 0)
		return;
	if (CLEAN)
		PIN = {};
	CLEAN = true;
});