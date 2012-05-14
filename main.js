var fs = require("fs");
var {Parser} = require("ringo/args");
var dates = require("ringo/utils/dates");
var docParser = require("./parser");
var mustache = require('ringo/mustache');
var templates = {
    page: getResource('./templates/page.html').content
};

/**
 * Print script help
 */
var printHelp = function(parser) {
    print('Create Macro/Filter documentation for Helma Applications.');
    print('Usage:');
    print('  ringo main.js [sourcedirs]');
    print('Options:');
    print(parser.help());
    return;
};

function copyStaticFiles(dir) {
    var dest = fs.join(dir, "static");
    fs.makeTree(dest);
    fs.copyTree(fs.join(module.directory, "static"), dest);
    return;
}

var renderDocs = function(sourceDirs, destDir, title) {
    var jsDocs = docParser.getJsDocs(sourceDirs);

    var context = {
        "title": title || "HelmaDoc",
        "timestamp": dates.format(new Date(), "dd.MM.yyyy, HH:mm"),
        "list": jsDocs.map(function(docItem, i) {
            return {
                "type": docItem.name.substring(docItem.name.lastIndexOf("_") + 1),
                "path": docItem.path,
                "lineno": docItem.lineno,
                "prototype": docItem.proto,
                "name": docItem.name.substring(0, docItem.name.indexOf("_")),
                "args": docItem.args,
                "description": docItem.getTag("description") || "",
                "hasParameters": docItem.getParameterList().length > 0,
                "hasReturnValue": docItem.getTag("returns") != null,
                "hasExample": docItem.getTag("example") != null,
                "example": docItem.getTag("example"),
                "parameters": docItem.getParameterList(),
                "returnValue": docItem.getTag("returns"),
                "returnType": docItem.getTag("type"),
                "source": docItem.source,
                "example": docItem.getTag("example"),
                "since": docItem.getTag("since") || "unknown",
                "status": docItem.getTag("status") || "unknown",
                "deprecated": docItem.getTag("deprecated")
            };
        }),

        "className": function() {
            return [this.prototype, this.name, this.type].join("-").replace(/[\._]/g, "-");
        },

        "join": function(arr) {
            return arr.join(", ");
        }
    };
    var html = mustache.to_html(templates.page, context);
    var destPath = fs.join(destDir, 'index.html');
    fs.write(destPath, html);
};

var main = function(args) {
    var parser = new Parser();
    parser.addOption("d", "destination", "destination", "Destination directory for output files (default: 'out')");
    parser.addOption("h", "help", null, "Print help message and exit");
    parser.addOption("t", "title", "title", "The title to use in generated pages");

    var script = args.shift();
    var opts = parser.parse(args, {});
    if (args.length < 1 || opts.help) {
        printHelp(parser);
        return;
    }

    for each (var source in args) {
        if (!fs.exists(source)) {
            throw new Error("Source '" + source + "' does not exist.");
        }
    }

    var destination = fs.join(opts.destination || './out/');
    // check if destination directory exists and is empty
    var dest = new fs.Path(destination);
    if (!dest.exists()) {
        dest.makeTree();
    } else if (!dest.isDirectory()) {
        throw new Error(dest + ' exists but is not a directory.');
    }

    renderDocs(args, destination, opts.title);
    copyStaticFiles(destination);
};

if (require.main == module) {
    try {
        main(system.args);
    } catch (error) {
        print(error);
        print('Use -h or --help to get a list of available options.');
    }
}
