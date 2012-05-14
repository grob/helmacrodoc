$(document).ready(function() {

    $("figure.source code").each(function(idx, element) {
        hljs.highlightBlock(element, '    ');
    });

    $("body").delegate("a.toggle", "click", function() {
        var $link = $(this);
        $link.toggleClass("expanded");
        $link.next().fadeToggle("fast");
        return false;
    });


    /**
     * Client-side filtering
     */
    var filter = function($list, value) {
        if (typeof(value) === "string" && value.length > 0) {
            var re = new RegExp(value, "i");
            $list.find("li").each(function(idx, item) {
                var $item = $(item);
                var $link = $item.find("a");
                var isMatch = re.test($link.text());
                $item.toggle(isMatch);
                $($link.attr("href")).toggle(isMatch);
            });
        } else {
            $("li", $list).show();
            $(".methods li").show();
        }
    };

    // hijack all links in the method navigation list and manually
    // scroll to the desired method description
    var $list = $("nav ul").delegate("li a", "click", function(event) {
        var $link = $(event.target);
        var $listItem = $($link.attr("href"));
        $("html, body").scrollTop($listItem.position().top);
        return false;
    });

    var $searchInput = $("#search").focus().bind("keyup", function(event) {
        // filter list without changing the location hash if
        // the user doesn't hit the enter key
        if (!event.keyCode || event.keyCode != 13) {
            filter($list, $searchInput.val());
            return;
        }
        // otherwise write the searchinput's value into the location
        // hash (hashchange event triggers the actual filtering)
        window.location.hash = $.trim($searchInput.val());
    });

    // ESC clears the search and focuses the search input
    $(document).bind("keyup", function(event) {
        if (event.keyCode == 27) {
            window.location.hash = "";
            $searchInput.val("").focus().trigger("keyup");
        }
    });

    // trigger filtering when the location hash changes or
    // the document is ready
    $(window).hashchange(function(event) {
        var hashValue = (window.location.hash || "").replace(/^#?!?/, "");
        if (hashValue != $searchInput.val()) {
            $searchInput.val(hashValue);
        }
        filter($searchInput.next(), hashValue);
    }).trigger("hashchange");
});
