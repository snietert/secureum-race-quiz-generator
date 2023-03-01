const { log } = require("console");
const fs = require("fs");
const util = require("util");

var showdown = require("showdown"),
  converter = new showdown.Converter();

// get all RACE files (sorted)
var races = getAllRacesSorted("./RACE").slice(0, 1);

// convert races markdown into manageable data structure
races = getDataStructureForRaces(races);

// write index page
writeIndexPage(races);

// write quiz pages for races
writeQuizzPages(races);

// ---------------------------------- FUNCTIONS ----------------------------------

function getDataStructureForRaces(races) {
  return races.map((race) => {
    // read markdown from file
    const markdown = fs.readFileSync(race.pathAndFilename).toString();

    // split markdown into questions
    var questions = markdown.split("---").filter((q) => q.trim().length);

    // go through all questions
    race.questions = questions.map((question) => {
      const q = {};

      const questionAndAnswers = question.split("```");

      // add headline and code
      q.headline = questionAndAnswers[0].trim();
      q.code = "```" + questionAndAnswers[1] + "```";

      // add answers (including resolution)
      const correctAnswers = questionAndAnswers[2]
        .match(/Answers\](.+)\*\*/)[1]
        .trim()
        .split(",");

      q.answers = questionAndAnswers[2].match(/\([A-Z]\):.+/g).map((answer) => {
        const letter = answer.match(/\(([A-Z])\)/)[1];
        return {
          letter,
          text: answer.match(/:.+/)[0].trim(),
          correct: correctAnswers.includes(letter),
        };
      });

      return q;
    });

    return race;
  });
}

function getAllRacesSorted(path) {
  return fs
    .readdirSync(path)
    .filter((f) => f.startsWith("RACE"))
    .map((f) => {
      return {
        number: parseInt(f.match(/\d+/g)[0]),
        pathAndFilename: `${path}/${f}`,
      };
    })
    .sort((a, b) => a.number - b.number);
}

function writeIndexPage(races) {
  var indexPage = "<html><body>";
  for (const race of races) {
    indexPage += `<a href="./race_${race.number}.html">RACE ${race.number}</a>`;
  }
  indexPage += "<body><html>";
  if (!fs.existsSync("./quizzes")) {
    fs.mkdirSync("./quizzes");
  }

  fs.writeFileSync("./quizzes/index.html", indexPage);
}

function writeQuizzPages(races) {
  races.forEach(writeQuizPage);
}

function writeQuizPage(race) {
  // open page
  var quizzPage = "<html><head>";

  // add scripts
  quizzPage += `<script type="text/javascript">

  function getUnAnsweredQuestions() {
    var inputs = document.getElementsByTagName("input");

    // count the number of checked checkboxes per question
    var checkedCount = {};
    for(var i = 0; i < inputs.length; i++) {
        var input = inputs[i];
        if(input.type == "checkbox") {
            var number = parseInt(input.name) + 1;
            if (!checkedCount[number]) {
                checkedCount[number] = 0;
            }
            checkedCount[number] += input.checked ? 1 : 0; // NOTE: We assume in every question at least 1 checkbox must be set
        }
    }

    // collect all questions that were not answered
    const unansweredQuestions = []
    for (var [key, value] of Object.entries(checkedCount)) {
        if (value === 0) {
            unansweredQuestions.push(key);
        }
    }
    return unansweredQuestions;
  }

  function selectAllAnswers () {
    var inputs = document.getElementsByTagName("input");
    for(var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      if(input.type == "checkbox") {
        input.checked = true;
      }
    }
  }

  function validate() {
    // check if all questions were answered
    var unansweredQuestions = getUnAnsweredQuestions();
    if (unansweredQuestions.length) {
      alert("QUESTIONS " + unansweredQuestions + " WERE NOT ANSWERED!");
      return;
    }

    // validate all checkboxes and format answers
    var inputs = document.getElementsByTagName("input");
    for(var i = 0; i < inputs.length; i++) {
        var input = inputs[i];
        if(input.type == "checkbox") {
            const isCorrectAnswer = "" + input.checked === input.getAttribute("correct");

            // correct answer not checked => red
            // correct answer checked => green
            // incorrect answer checked => red
            // incorrect answer not checked =? green

            if (isCorrectAnswer) {
                document.getElementById(input.id).className = "success";
                findLableForInput(input.id).className = "success";
            } else {
                document.getElementById(input.id).className = "error";
                findLableForInput(input.id).className = "error";
            }
        }  
    }
  }

  function findLableForInput(id) {
    labels = document.getElementsByTagName('label');
    for( var i = 0; i < labels.length; i++ ) {
       if (labels[i].htmlFor == id)
            return labels[i];
    }
    return null;
 }
  
  </script>

  <style>
    .error { background: red; color: #fff; }
    .success { background: #008000; color: #fff; }
    code { font-family: monospace; }
    pre { background: #eee; padding: 10px; }
  </style>
  `;

  quizzPage += "</head><body>";

  // page head
  quizzPage += `<a href="./index.html"><< BACK</a><br/><br/>`;
  quizzPage += `<h1>RACE ${race.number}</h1>`;

  quizzPage += `<input type="submit" value="VALIDATE ANSWERS" onclick="validate()"/>&nbsp;`;
  quizzPage += `<input type="submit" value="SELECT ALL ANSWERS" onclick="selectAllAnswers()"/>`;

  // questions
  race.questions.forEach((question, x) => {
    quizzPage += converter.makeHtml(question.headline);
    quizzPage += converter.makeHtml(question.code);
    question.answers.forEach((answer, i) => {
      const id = `${x}_${i}`;
      if (i !== 0) {
        quizzPage += "<br/>";
      }
      const label = converter.makeHtml(answer.text).slice(5, -4); // TODO correct the 5 (see unsliced string!)
      quizzPage += `<input type="checkbox" name="${x}" id="${id}" correct="${answer.correct}"><label for="${id}">${answer.letter}: ${label}</label>`;
    });

    quizzPage += `<br/><br/><span>ANSWERS: ${question.answers
      .filter((a) => a.correct)
      .map((a) => a.letter)}</span>`;

    if (x < race.questions.length - 1) {
      quizzPage += "<hr/>";
    }
  });

  // validation button
  quizzPage += `<br/><br/><input type="submit" value="VALIDATE ANSWERS" onclick="validate()"/>`;

  // close page
  quizzPage += "</body></html>";

  // write page to file
  fs.writeFileSync(`./quizzes/race_${race.number}.html`, quizzPage);
}
