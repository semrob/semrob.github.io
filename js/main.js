(function(window, document) {
    "use strict";

    function onReady(callback) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", callback);
        } else {
            callback();
        }
    }

    function escapeHTML(value) {
        return String(value || "").replace(/[&<>"']/g, function(character) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                "\"": "&quot;",
                "'": "&#39;"
            }[character];
        });
    }

    function parseCSV(text) {
        var rows = [];
        var row = [];
        var value = "";
        var insideQuotes = false;

        for (var i = 0; i < text.length; i++) {
            var character = text[i];

            if (character === "\"") {
                if (insideQuotes && text[i + 1] === "\"") {
                    value += "\"";
                    i++;
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (character === "," && !insideQuotes) {
                row.push(value.trim());
                value = "";
            } else if ((character === "\n" || character === "\r") && !insideQuotes) {
                if (character === "\r" && text[i + 1] === "\n") {
                    i++;
                }

                row.push(value.trim());
                if (row.some(function(cell) { return cell.length > 0; })) {
                    rows.push(row);
                }
                row = [];
                value = "";
            } else {
                value += character;
            }
        }

        row.push(value.trim());
        if (row.some(function(cell) { return cell.length > 0; })) {
            rows.push(row);
        }

        if (!rows.length) {
            return [];
        }

        var headers = rows.shift().map(function(header) {
            return header.trim();
        });

        return rows.map(function(values) {
            var paper = {};
            headers.forEach(function(header, index) {
                paper[header] = values[index] || "";
            });
            return paper;
        });
    }

    function generatePaperHTML(paper) {
        var paperNumber = paper.paper_number || paper.forum_id || "paper";
        var abstractId = "paper-abstract-" + String(paperNumber).replace(/[^\w-]/g, "");
        var title = escapeHTML(paper.title);
        var authors = escapeHTML(paper.authors);
        var abstract = escapeHTML(paper.abstract);
        var forumId = String(paper.forum_id || "").trim();
        var isSpotlight = String(paper.spotlight || "").toLowerCase() === "true";
        var isBestPaper = String(paper.best_paper || "").toLowerCase() === "true";
        var openReviewUrl = forumId ? "https://openreview.net/forum?id=" + encodeURIComponent(forumId) : "";
        var spotlightBadge = isSpotlight
            ? '<span class="badge badge-warning paper-badge">Spotlight</span>'
            : "";
        var bestPaperBadge = isBestPaper
            ? '<span class="badge badge-danger paper-badge">Best paper</span>'
            : "";
        var forumLink = openReviewUrl
            ? '<a class="paper-forum-link" href="' + openReviewUrl + '" target="_blank" rel="noopener noreferrer" aria-label="Open paper forum" title="OpenReview forum">PDF</a>'
            : "";

        return [
            '<div class="paper-entry">',
            '    <h5 class="paper-title">' + title + '</h5>',
            '    ' + spotlightBadge + bestPaperBadge,
            '    <br>',
            '    <span class="paper-authors">' + authors + '</span>',
            '    <br>',
            '    ' + forumLink,
            '    <button type="button" class="abstract-toggle paper-abstract-toggle collapsed"',
            '            data-target="#' + abstractId + '" aria-expanded="false"',
            '            aria-controls="' + abstractId + '">Abstract (click to expand)</button>',
            '    <div id="' + abstractId + '" class="collapse paper-abstract-body">',
            '        ' + abstract,
            '    </div>',
            '</div>'
        ].join("");
    }

    function initializePaperAbstractToggles(container) {
        var toggles = container.querySelectorAll(".paper-abstract-toggle");

        Array.prototype.forEach.call(toggles, function(toggle) {
            var targetSelector = toggle.getAttribute("data-target");
            var collapse = targetSelector ? container.querySelector(targetSelector) : null;
            if (!collapse) return;

            function setExpanded(isExpanded) {
                collapse.classList.toggle("show", isExpanded);
                toggle.classList.toggle("collapsed", !isExpanded);
                toggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
                toggle.textContent = isExpanded ? "Abstract (click to collapse)" : "Abstract (click to expand)";
            }

            setExpanded(collapse.classList.contains("show"));
            toggle.addEventListener("click", function() {
                setExpanded(!collapse.classList.contains("show"));
            });
        });
    }

    function requestText(url, onSuccess, onError) {
        if (window.fetch) {
            window.fetch(url, { cache: "no-store" })
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error("HTTP " + response.status);
                    }
                    return response.text();
                })
                .then(onSuccess)
                .catch(onError);
            return;
        }

        var request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.onreadystatechange = function() {
            if (request.readyState !== 4) return;
            if (request.status >= 200 && request.status < 300) {
                onSuccess(request.responseText);
            } else {
                onError(new Error("HTTP " + request.status));
            }
        };
        request.send();
    }

    function loadAcceptedPapers() {
        var container = document.getElementById("papers-container");
        if (!container) {
            return;
        }

        requestText("static/26_ICRA/papers.csv", function(data) {
            var papers;

            try {
                papers = parseCSV(data);
            } catch (error) {
                container.innerHTML = '<p class="papers-error">Error loading papers. Please refresh the page.</p>';
                if (window.console && window.console.error) {
                    window.console.error("Error parsing CSV:", error);
                }
                return;
            }

            if (!papers.length) {
                container.innerHTML = '<p class="papers-loading">No papers available yet.</p>';
                return;
            }

            try {
                container.innerHTML = papers.map(generatePaperHTML).join("");
                initializePaperAbstractToggles(container);
            } catch (error) {
                container.innerHTML = '<p class="papers-error">Error loading papers. Please refresh the page.</p>';
                if (window.console && window.console.error) {
                    window.console.error("Error rendering papers:", error);
                }
            }
        }, function(error) {
            container.innerHTML = '<p class="papers-error">Error loading papers. Please refresh the page.</p>';
            if (window.console && window.console.error) {
                window.console.error("Error loading CSV:", error);
            }
        });
    }

    onReady(loadAcceptedPapers);

    if (!window.jQuery) {
        return;
    }

    var $ = window.jQuery;

    $(window).on("scroll", function() {
        var scrollTop = $(window).scrollTop();
        $(".parallax-bg").css("transform", "translateY(" + scrollTop * 0.4 + "px)");
    });

    function updateCountdown(elementId, deadlineDate) {
        var element = document.getElementById(elementId);
        if (!element) return;

        var deadline = new Date(deadlineDate + "T23:59:59-12:00");

        function update() {
            var now = new Date();
            var diff = deadline - now;

            if (diff <= 0) {
                element.textContent = "(Deadline passed)";
                element.style.color = "#999";
                return;
            }

            var days = Math.floor(diff / (1000 * 60 * 60 * 24));
            var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            var seconds = Math.floor((diff % (1000 * 60)) / 1000);

            var countdownText = "(";
            if (days > 0) {
                countdownText += days + "d ";
            }
            if (hours > 0 || days > 0) {
                countdownText += hours + "h ";
            }
            if (minutes > 0 || hours > 0 || days > 0) {
                countdownText += minutes + "m ";
            }
            countdownText += seconds + "s remaining)";
            element.textContent = countdownText;
        }

        update();
        setInterval(update, 1000);
    }

    function initializeCollapsibleSections() {
        $(".collapsible-section").each(function() {
            var $section = $(this);
            var $collapse = $section.find(".collapse").first();
            var $toggles = $section.find(".collapsible-header, .collapsible-expand-prompt");
            var isMobileOnly = $section.hasClass("collapsible-section-mobile-only");

            function isMobileView() {
                return $(window).width() <= 480;
            }

            function setSectionExpanded(isExpanded) {
                $section.toggleClass("is-expanded", isExpanded);
                $toggles.attr("aria-expanded", isExpanded ? "true" : "false");
                $toggles.toggleClass("collapsed", !isExpanded);
            }

            function syncSectionState() {
                setSectionExpanded(isMobileOnly && !isMobileView() ? true : $collapse.hasClass("show"));
            }

            $toggles.on("click", function(event) {
                if (isMobileOnly && !isMobileView()) {
                    event.preventDefault();
                    event.stopPropagation();
                    setSectionExpanded(true);
                    return false;
                }
            });

            $collapse
                .on("show.bs.collapse", function() {
                    setSectionExpanded(true);
                })
                .on("hide.bs.collapse", function() {
                    setSectionExpanded(false);
                });

            syncSectionState();
            $(window).on("resize", syncSectionState);
        });
    }

    function initializeAbstractToggles() {
        $(".abstract-toggle").not(".paper-abstract-toggle").each(function() {
            var $toggle = $(this);
            var targetSelector = $toggle.attr("data-target");
            var $collapse = $(targetSelector);

            function setAbstractExpanded(isExpanded) {
                $toggle.text(isExpanded ? "Abstract (click to collapse)" : "Abstract (click to expand)");
                $toggle.attr("aria-expanded", isExpanded ? "true" : "false");
            }

            $collapse
                .on("show.bs.collapse", function() {
                    setAbstractExpanded(true);
                })
                .on("hide.bs.collapse", function() {
                    setAbstractExpanded(false);
                });

            setAbstractExpanded($collapse.hasClass("show"));
        });
    }

    function initializeScheduleLayout() {
        var $schedule = $("#schedule");
        var $scheduleContent = $schedule.find(".col-md-10").first();

        function updateScheduleLayout() {
            var contentWidth = $scheduleContent.outerWidth() || $(window).width();
            $schedule.toggleClass("schedule-compact", contentWidth < 900);
        }

        updateScheduleLayout();
        $(window).on("resize orientationchange", updateScheduleLayout);
    }

    $(document).ready(function() {
        updateCountdown("countdown-nonarchival-submission", "2026-03-22");
        initializeScheduleLayout();
        initializeCollapsibleSections();
        initializeAbstractToggles();
    });
})(window, document);
