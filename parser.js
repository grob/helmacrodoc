var {ScriptRepository} = require("ringo/jsdoc");
var {Parser, Token, getTypeName} = require('ringo/parser');
var fs = require("fs");
var strings = require("ringo/utils/strings");
var FileResource = org.ringojs.repository.FileResource;

exports.getJsDocs = function(sources) {
    var jsDocs = [];
    var visited = {};

    for each (var source in sources) {
        if (fs.isDirectory(source)) {
            (new ScriptRepository(source)).getScriptResources(true).forEach(function(r) {
                parseJsDocs(r, jsDocs, visited);
            });
        } else if (fs.isFile(source)) {
            parseJsDocs(new FileResource(source), jsDocs, visited);
        }
    }
    jsDocs.sort(function(d1, d2) {
        if (d1.proto < d2.proto) {
            return -1;
        } else if (d1.proto > d2.proto) {
            return 1;
        } else {
            if (d1.name < d2.name) {
                return -1;
            } else if (d1.name > d2.name) {
                return 1;
            }
            return 0;
        }
    });
    return jsDocs;
};

/**
 * A simple wrapper around the tags of a JSDoc doclet
 * @param {Array} tags The raw tags
 * @constructor
 */
var Tags = function(tags) {

    this.get = function(name) {
        name = name.toLowerCase();
        for each (var tag in tags) {
            if (tag[0] == name) {
                return tag[1];
            }
        }
        return null;
    };

    this.getAll = function(name) {
        name = name.toLowerCase();
        return tags.filter(function(tag) {
            return tag[0] == name;
        }).map(function(tag) {
            return tag[1];
        });
    };

    return this;
};

/**
 * The prototype used for document items
 */
var jsDocPrototype = {

    "getTag": function(name) {
        return this.tags.get(name) || null;
    },

    "getTags": function(name) {
        return this.tags.getAll(name);
    },

    "getParameterList": function() {
        if (!this.parameterList) {
            var params = this.getTags("param");
            this.parameterList = params.map(function(p) {
                var words = p.split(" ");
                var type = words[0].match(/^{(\S+)}$/);
                type = type && type[1];
                var name = type ? words[1] : words[0];
                var description = words.slice(type ? 2 : 1).join(" ");
                return {
                    "type": type,
                    "name": name,
                    "description": description
                };
            });
        }
        return this.parameterList;
    }
};

/**
 * Parse a JSDoc comment into an object wrapping an array of tags as [tagname, tagtext]
 * and getTag() and getTags() methods to lookup specific tags.
 * @param {String} comment the raw JSDoc comment
 * @returns {Object} an array of tags.
 */
var extractTags = function(comment) {
    if (!comment) {
        comment = "";
    } else if (strings.startsWith(comment, "/**")) {
        comment = unwrapComment(comment).trim();
    }
    var lines = comment
            .split(/(^|[\r\n]+)\s*@/)
            .filter(function($){
                return $.match(/\S/);
            });
    return lines.map(function(line, idx) {
        if (idx == 0 && !strings.startsWith(line, '@')) {
            return ["description", line.trim()];
        } else {
            var space = line.search(/\s/);
            if (space > -1) {
                return [line.substring(0, space).toLowerCase(),
                       line.substring(space + 1).trim()];
            } else {
                return [line.toLowerCase(), ""];
            }
        }
    });
};

/**
 * Remove slash-star comment wrapper from a raw comment string.
 * @param {String} comment The comment to unwrap
 * @returns {String} The unwrapped comment
 */
var unwrapComment = function(comment) {
    if (typeof(comment) === "string" && comment.length > 0) {
        return comment.replace(/(^\/\*\*|\*\/$)/g, "").replace(/^\s*\* ?/gm, "");
    }
    return "";
};

var getJsDoclet = function(proto, name, args, source, docs, path, lineno) {
    var tags = new Tags(extractTags(docs));
    // let @member tag in the doclet override the proto argument
    proto = tags.get("member") || proto;
    return Object.create(jsDocPrototype, {
        "key": {"value": proto + "-" + name},
        "proto": {"value": proto},
        "name": {"value": name},
        "args": {"value": args},
        "source": {"value": source},
        "tags": {"value": tags},
        "path": {"value": path},
        "lineno": {"value": lineno}
    });
};

var getProtoNameFromResource = function(resource) {
    var name = resource.getName();
    if (/^[A-Z]/.test(name)) {
        return name.split(".").filter(function(part) {
            return /^[A-Z]/.test(part);
        }).join(".");
    } else {
        // walk up the resource path until we find a directory whose name
        // starts with an uppercase letter
        var path = resource.getPath().split("/");
        var idx = path.length;
        while (idx > 0) {
            var part = path[idx - 1];
            if (/^[A-Z]/.test(part)) {
                return part;
            }
            idx -= 1;
        }
    }
    throw new Error("Unable to determine Prototype from Resource",
            resource.getPath());
};

var isMacroOrFilter = function(name) {
    return strings.endsWith(name, "_macro") || strings.endsWith(name, "_filter");
};

var getFunctionName = function(node) {
    if (node.parent.type === Token.ASSIGN) {
        var left = node.parent.left;
        if (left.type === Token.GETELEM) {
            // ["name"]
            return left.element.value;
        }
        return left.property.string;
    } else if (node.parent.type === Token.VAR) {
        // var name = function() {}
        return node.parent.target.getIdentifier();
    } else if (node.name != "") {
        // function name()
        return node.name;
    }
    return null;
};

var getFunctionArguments = function(node) {
    return (new ScriptableList(node.getParams())).map(function(node) {
        return node.getIdentifier();
    });
};

var resolveAssignment = function(node) {
    if (node.parent != null) {
        if (node.parent.type === Token.ASSIGN) {
            return nodeToString(node.parent.left);
        } else if (node.parent.type === Token.VAR) {
            return node.parent.target.string;
        }
    }
    return null;
};

var resolveJsDocNode = function(node) {
    if (node.parent != null) {
        if (node.parent.type === Token.ASSIGN) {
            return node.parent;
        } else if (node.parent.type === Token.VAR) {
            return node.parent.parent;
        }
    }
    return node;
};

var resolvePrototype = function(node, functionName) {
    if (node.enclosingFunction != null) {
        return resolvePrototype(node.enclosingFunction, functionName);
    }
    var protoName = resolveAssignment(node) || node.name || null;
    if (protoName != null) {
        var parts = protoName.split(".");
        if (parts[parts.length - 1] === functionName) {
            parts.pop();
        }
        if (parts[parts.length - 1] === "prototype") {
            parts.pop();
        }
        return parts.join(".") || null;
    }
    return null;
};

var parseJsDocs = function(resource, jsDocs, visited) {
    (new Parser({
        "parseComments": true
    })).visit(resource, function(node) {
        if (node.type === Token.FUNCTION) {
            var name = getFunctionName(node);
            if (name != null && isMacroOrFilter(name)) {
                var protoName = resolvePrototype(node, name) ||
                         getProtoNameFromResource(resource);
                // find the node that has the jsDoc attached
                var jsDocNode = resolveJsDocNode(node);
                var doclet = getJsDoclet(protoName, name, getFunctionArguments(node),
                        jsDocNode.toSource(), jsDocNode.jsDoc, getResourcePath(resource),
                        jsDocNode.lineno);
                if (!visited[doclet.key]) {
                    jsDocs.push(doclet);
                    visited[doclet.key] = true;
                } else {
                    console.warn("Already found", name, "for prototype",
                             protoName, "... ignoring");
                }
            }
        }
        return true;
    });
};

var getResourcePath = function(resource) {
    var parts = fs.split(resource.getPath());
    return parts.splice(-3).join("/");
};

var nodeToString = function(node) {
    if (node.type == Token.GETPROP) {
        return [nodeToString(node.target), node.property.string].join('.');
    } else if (node.type == Token.NAME) {
        return node.string;
    } else if (node.type == Token.STRING) {
        return node.value;
    } else if (node.type == Token.THIS) {
        return "this";
    } else {
        return getTypeName(node);
    }
};
