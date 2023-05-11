const Basic = require("./basic");
const Path = require("node:path");
const Nacl  = require("tweetnacl/nacl-fast");
const Util = require("../common-util");

const Sessions = module.exports;
/*  This module manages storage for per-acccount session tokens - currently assumed to be
    JSON Web Tokens (JWTs).

    Decisions about what goes into each of those JWTs happens upstream, so the storage
    itself is relatively unopinionated.

    The key things to understand are:

* valid sessions allow the holder of a given JWT to access a given "login block"
* JWTs are signed with a key held in the server's memory. If that key leaks then it should be rotated (with the SET_BEARER_SECRET decree) to invalidate all existing JWTs. Under these conditions then all tokens signed with the old key can be removed. Garbage collection of these older tokens is not implemented.
* it is expected that any given login-block can have multiple active sessions (for different devices, or if their browser clears its cache automatically). All sessions for a given block are stored in a per-user directory which is intended to make listing or iterating over them simple.
* It could be desirable to expose the list of sessions to the relevant user and allow them to revoke sessions individually or en-masse, though this is not currently implemented.

*/

var pathFromId = function (Env, id, ref) {
    if (!id || typeof(id) !== 'string') { return; }
    id = Util.escapeKeyCharacters(id);
    return Path.join(Env.paths.base, "sessions", id.slice(0, 2), id, ref);
};

Sessions.randomId = () => Nacl.util.encodeBase64(Nacl.randomBytes(24)).replace(/\//g, '-');

Sessions.read = function (Env, id, ref, cb) {
    var path = pathFromId(Env, id, ref);
    Basic.read(Env, path, cb);
};

Sessions.write = function (Env, id, ref, data, cb) {
    var path = pathFromId(Env, id, ref);
    Basic.write(Env, path, data, cb);
};

Sessions.delete = function (Env, id, ref, cb) {
    var path = pathFromId(Env, id, ref);
    Basic.delete(Env, path, cb);
};

// XXX All of a user's sessions should be removed When a user deletes their account
// The fact that each user is given their own publicKey-scoped directory makes them easy
// to remove all at once. Nodejs provides an easy way to `rm -rf` since 14.14.0:
// Fs.rm(dir, { recursive: true, force: true }, console.log)
// just be careful to validate the directory's path
// --Aaron
