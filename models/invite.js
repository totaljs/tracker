NEWSCHEMA('Invite').make(function(schema) {

	schema.define('name', 'String(80)', true);  // name of tracker
	schema.define('owner', 'Email', true);      // owner
	schema.define('issues', '[String(80)]');    // list of issues
	schema.define('email', 'Email', true);      // a new member

	schema.addWorkflow('send', function(error, model, controller, callback) {
		model.hostname = controller.uri.hostname;
		F.mailmembers([model.email], '@(Invitation: {0})'.format(model.name), 'invite', model, controller.language);
		callback(SUCCESS(true));
		NOSQL('invitations').insert(model);
	});

});