# Free and simple open-source Issue Tracker

__Requirements__:

- node.js platform +v4
- total.js +v2 `npm install total.js@beta`
- SMTP sender __open `config`__

## How does it works?

The application works without any registration. Each member is authorized via its email and the session cookie is valid for 1 month. So each member can create its trackers (the tracker is a document with unlimited count of issues).

Creating a new issue is very easy. The editor supports uploading files, base text formmating (CMD+B `bold`, CMD+I `italic`, CMD+U `underline`) and automatically it highlights links and emoticons.