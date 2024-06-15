"use strict";

var Bluebird = require("bluebird");

var DEFAULT_TYPE = "other";
var PR_REGEX = new RegExp(/#[1-9][\d]*/g);
var TYPES = [
  {
    title_en: "Breaking Changes",
    title_de: "Breaking Changes",
    gitmoji: ["💥"],
  },
  { title_en: "New Features", title_de: "Neue Features", gitmoji: ["✨"] },
  {
    title_en: "Bug Fixes",
    title_de: "Fehlerbehebungen",
    gitmoji: ["🐛", "🩹", "🚨", "✏️"],
  },
  {
    title_en: "Refactors",
    title_de: "Refactorings",
    gitmoji: ["♻️", "🚚", "⚰"],
  },
  {
    title_en: "Documentation Changes",
    title_de: "Dokumentation",
    gitmoji: ["📝"],
  },
  {
    title_en: "Styling Improvements",
    title_de: "Optische Anpassungen",
    gitmoji: ["💄", "📱"],
  },
  {
    title_en: "Dependencies",
    title_de: "Abhängigkeiten",
    gitmoji: ["➕", "➖", "⬇️", "⬆", "📌"],
  },
  { title_en: "Build System", title_de: "Build System", gitmoji: ["👷", "💚"] },
  {
    title_en: "Configurations and Scripts",
    title_de: "Konfigurationen und Skripte",
    gitmoji: ["🔧", "🔨"],
  },
  {
    title_en: "Performance Improvements",
    title_de: "Performanceverbesserungen",
    gitmoji: ["⚡️"],
  },
  {
    title_en: "Code Style Changes",
    title_de: "Codestilanpassungen",
    gitmoji: ["🎨"],
  },
  {
    title_en: "Quick Implementations",
    title_de: "Schnelle Implementierungen",
    gitmoji: ["💩", "🍻"],
  },
  {
    title_en: "Development",
    title_de: "Entwicklung",
    gitmoji: ["🧑‍💻", "🔊", "🔇", "🙈", "🗃️"],
  },
];

// {
//   build: 'Build System',
//   chore: 'Chores',
//   other: 'Other Changes',
//   revert: 'Reverts',
//   "🎨": 'Code Style Changes',
//   test: 'Tests'
// };
// [
// "🎨",
//   "",
//   "🔥",
//   "🚑️",
//   "",
//   "🚀",
//   "",
//   "🎉",
//   "✅",
//   "🔒️",
//   "🔐",
//   "🔖",
//   "🚧",
//   "📈",
//   "🌐",
//   "📦️",
//   "👽️",
//   "",
//   "📄",
//   "🍱",
//   "♿️",
//   "💡",
//   "💬",
//   "",
//   "👥",
//   "🚸",
//   "🏗️",
//   "",
//   "🤡",
//   "🥚",
//   "",
//   "📸",
//   "⚗️",
//   "🔍️",
//   "🏷️",
//   "🌱",
//   "🚩",
//   "🥅",
//   "💫",
//   "🗑️",
//   "🛂",
//   "🧐",
//   "️",
//   "🧪",
//   "👔",
//   "🩺",
//   "🧱",
//   "💸",
//   "🧵",
//   "🦺"
// ];

/**
 * Generate the commit URL for the repository provider.
 * @param {String} baseUrl - The base URL for the project
 * @param {String} commitHash - The commit hash being linked
 * @return {String} The URL pointing to the commit
 */
exports.getCommitUrl = function (baseUrl, commitHash) {
  var urlCommitName = "commit";

  if (baseUrl.indexOf("bitbucket") !== -1) {
    urlCommitName = "commits";
  }

  if (baseUrl.indexOf("gitlab") !== -1 && baseUrl.slice(-4) === ".git") {
    baseUrl = baseUrl.slice(0, -4);
  }

  return baseUrl + "/" + urlCommitName + "/" + commitHash;
};

/**
 * Generate the markdown for the changelog.
 * @param {String} version - the new version affiliated to this changelog
 * @param {Array<Object>} commits - array of parsed commit objects
 * @param {Object} options - generation options
 * @param {Boolean} options.patch - whether it should be a patch changelog
 * @param {Boolean} options.minor - whether it should be a minor changelog
 * @param {Boolean} options.major - whether it should be a major changelog
 * @param {String} options.repoUrl - repo URL that will be used when linking commits
 * @returns {Promise<String>} the \n separated changelog string
 */
exports.markdown = function (version, commits, options) {
  var content = [];
  var date = new Date().toJSON().slice(0, 10);
  var heading;

  if (options.major) {
    heading = "##";
  } else if (options.minor) {
    heading = "###";
  } else {
    heading = "####";
  }

  if (version) {
    heading += " " + version + " (" + date + ")";
  } else {
    heading += " " + date;
  }

  content.push(heading);
  content.push("");

  return Bluebird.resolve(commits)
    .bind({ types: {} })
    .each(function (commit) {
      var type =
        TYPES[commit.type] || options.allowUnknown ? commit.type : DEFAULT_TYPE;
      var category = commit.category;

      this.types[type] = this.types[type] || {};
      this.types[type][category] = this.types[type][category] || [];

      this.types[type][category].push(commit);
    })
    .then(function () {
      return Object.keys(this.types).sort();
    })
    .each(function (type) {
      var types = this.types;
      var typeDescription = TYPES[type];

      if (!typeDescription && options.allowUnknown) {
        typeDescription = TYPES.other + " (" + type + ")";
      }

      content.push("##### " + typeDescription);
      content.push("");

      Object.keys(this.types[type]).forEach(function (category) {
        var prefix = "*";
        var nested = types[type][category].length > 1;
        var categoryHeading =
          prefix + (category ? " **" + category + ":**" : "");

        if (nested && category) {
          content.push(categoryHeading);
          prefix = "  *";
        } else {
          prefix = categoryHeading;
        }

        types[type][category].forEach(function (commit) {
          var shorthash = commit.hash.substring(0, 8);
          var subject = commit.subject;

          if (options.repoUrl) {
            shorthash =
              "[" +
              shorthash +
              "](" +
              exports.getCommitUrl(options.repoUrl, commit.hash) +
              ")";

            subject = subject.replace(PR_REGEX, function (pr) {
              return (
                "[" + pr + "](" + options.repoUrl + "/pull/" + pr.slice(1) + ")"
              );
            });
          }

          content.push(prefix + " " + subject + " (" + shorthash + ")");
        });
      });

      content.push("");
    })
    .then(function () {
      content.push("");
      return content.join("\n");
    });
};
