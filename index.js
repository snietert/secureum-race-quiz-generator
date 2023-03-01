const fs = require("fs");
var showdown = require("showdown"),
  converter = new showdown.Converter();

// get all RACE files (sorted)
var races = getAllRacesSorted("./RACE");

// convert races markdown into manageable data structure
races = getDataStructureForRaces(races);

// write index page
writeIndexPage(races);

// write quiz pages for races
writeQuizzPages(races);

// ---------------------------------- FUNCTIONS ----------------------------------

function getDataStructureForRaces(races) {
  return races.map((race) => {
    console.log(`GENERATING QUIZ FOR RACE ${race.number}`);

    // read markdown from file
    const markdown = fs.readFileSync(race.pathAndFilename).toString();

    // detect and store which RACE layout is applied
    const isRaceZeroLayout = !markdown.startsWith("**Note**:");
    race.layout = isRaceZeroLayout ? "zero" : "after_zero";

    // handle race depending to layout
    if (isRaceZeroLayout) {
      return handleRaceZeroLayout(race, markdown);
    } else {
      return handleNonRaceZeroLayout(race, markdown);
    }
  });
}

function handleRaceZeroLayout(race, markdown) {
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
}

function handleNonRaceZeroLayout(race, markdown) {
  // split markdown into notes, code and questions
  const notesCodeAndQuestions = markdown
    .split("---")
    .filter((q) => q.trim().length);

  // add notes and code
  const notesAndCode = notesCodeAndQuestions[0].split("```");
  race.notes = notesAndCode[0];
  race.code = "```" + notesAndCode[1] + "```";

  // add questions
  var questions = notesCodeAndQuestions.slice(1).map(removeBackSlashes);
  race.questions = questions.map((question, index) => {
    const q = {};

    var questionAndAnswers = question
      .split("\n")
      .map((e) => e.trim())
      .filter((e) => e.length);

    questionAndAnswers = [
      questionAndAnswers[0],
      questionAndAnswers.slice(1, -1).join("\n"),
      questionAndAnswers[questionAndAnswers.length - 1],
    ];

    // add headline
    q.headline = questionAndAnswers[0].trim();

    // add answers (including resolution)
    const correctAnswers = questionAndAnswers[2]
      .match(/Answers\]:?(.+)\*\*/)[1]
      .trim()
      .split(",");

    const answers = questionAndAnswers[1].split("\n");

    // NOTE: We need to handle single answers spread across multiple lines (e.g. source code in answer)
    const mergedAnswers = [];
    answers.forEach((answer) => {
      // NOTE: We assume that only questions start with "("
      if (!answer.startsWith("(")) {
        mergedAnswers[mergedAnswers.length - 1] += " " + answer; // TODO: Improve (e.g. add newlines again)
      } else {
        mergedAnswers.push(answer);
      }
    });

    q.answers = mergedAnswers.map((answer) => {
      const letter = answer.match(/\(([A-Z])\)/)[1];
      return {
        letter,
        text: converter.makeHtml(removeBackSlashes(answer)),
        correct: correctAnswers.includes(letter),
      };
    });

    return q;
  });

  return race;
}

function removeBackSlashes(text) {
  return text.replace("\\", "");
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
  var indexPage = "<html><body><h1>Secureum Races</h1><ul>";
  for (const race of races) {
    indexPage += `<li><a href="./race_${race.number}.html">RACE ${race.number}</a></li>`;
  }
  indexPage += "</ul><body><html>";
  if (!fs.existsSync("./quizzes")) {
    fs.mkdirSync("./quizzes");
  }

  fs.writeFileSync("./quizzes/index.html", indexPage);
}

function writeQuizzPages(races) {
  races.forEach(writeQuizPage);
}

function writeQuizPage(race) {
  // get layout
  const layout = race.layout;
  if (!layout) {
    throw new Error(`No layout set for race ${race.number}`);
  }

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

  function clickSelectAllAnswersButton () {
    var inputs = document.getElementsByTagName("input");
    for(var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      if(input.type == "checkbox") {
        input.checked = true;
      }
    }
  }

  function clickValidateQuestionsButton() {
    var result = validate();
    var questionsCount = ${race.questions.length};
    if (result) {
      alert(result.length + " OF " + questionsCount + " QUESTIONS ANSWERED INCORRECTLY. RESULT STORED!");
    } else {
      alert("ALL " + questionsCount + " QUESTIONS ANSWERED CORRECTLY. RESULT STORED!");
    }
  }

  function validate() {
    // check if all questions were answered
    var unansweredQuestions = getUnAnsweredQuestions();

    // handle result
    if (unansweredQuestions.length) {
      alert("QUESTIONS " + unansweredQuestions + " WERE NOT ANSWERED!");
      return;
    }

    // validate all checkboxes and format answers
    var invalidAnsweredQuestions = [];
    var inputs = document.getElementsByTagName("input");
    for(var i = 0; i < inputs.length; i++) {
        var input = inputs[i];
        if(input.type == "checkbox") {
            const isCorrectAnswer = "" + input.checked === input.getAttribute("correct");
            if (isCorrectAnswer) {
                document.getElementById(input.id).className = "success";
                findLableForInput(input.id).className = "success";
            } else {
                var number = parseInt(input.name) + 1;
                if (!invalidAnsweredQuestions.includes(number)) {
                  invalidAnsweredQuestions.push(number);
                }
                document.getElementById(input.id).className = "error";
                findLableForInput(input.id).className = "error";
            }
        }  
    }

    return invalidAnsweredQuestions.length ? invalidAnsweredQuestions : null;
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

  quizzPage += `<input type="submit" value="VALIDATE ANSWERS" onclick="clickValidateQuestionsButton()"/>&nbsp;`;
  quizzPage += `<input type="submit" value="SELECT ALL ANSWERS" onclick="clickSelectAllAnswersButton()"/>`;

  if (layout !== "race") {
    quizzPage += converter.makeHtml(race.code);
  }

  // questions
  race.questions.forEach((question, x) => {
    quizzPage += converter.makeHtml(question.headline);
    if (layout === "race") {
      quizzPage += converter.makeHtml(question.code);
    }
    question.answers.forEach((answer, i) => {
      const id = `${x}_${i}`;
      if (i !== 0) {
        quizzPage += "<br/>";
      }
      const label = converter.makeHtml(answer.text).slice(3, -4).trim(); // NOTE: Slice remove the surrounding "p" tags
      quizzPage += `<input type="checkbox" name="${x}" id="${id}" correct="${answer.correct}"><label for="${id}">${label}</label>`;
    });

    quizzPage += `<br/><br/><span>ANSWERS: ${question.answers
      .filter((a) => a.correct)
      .map((a) => a.letter)}</span>`;

    if (x < race.questions.length - 1) {
      quizzPage += "<hr/>";
    }
  });

  // validation button
  quizzPage += `<br/><br/><input type="submit" value="VALIDATE ANSWERS" onclick="clickValidateQuestionsButton()"/>`;

  // close page
  quizzPage += "</body></html>";

  // write page to file
  fs.writeFileSync(`./quizzes/race_${race.number}.html`, quizzPage);
}
