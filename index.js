const fs = require("fs");
var showdown = require("showdown"),
  converter = new showdown.Converter();

// get all RACE files (sorted)
var races = getAllRacesSorted("./RACE");

// convert races markdown into manageable data structure
races = getDataStructureForRaces(races);

// write index page
writeIndexPage(races);

// write quiz pages for all races
writeQuizzPages(races);

// ---------------------------------- FUNCTIONS ----------------------------------

function getDataStructureForRaces(races) {
  return races.map((race) => {
    console.log(
      `\n--------------- GENERATING QUIZ FOR RACE ${race.number} --------------- `
    );

    // read markdown from file
    const markdown = fs.readFileSync(race.pathAndFilename).toString();

    // detect and store which RACE layout is applied
    const isRaceZeroLayout = !markdown.startsWith("**Note");
    race.layout = isRaceZeroLayout
      ? "race_zero_layout"
      : "not_race_zero_layout";

    // handle race depending to layout
    if (isRaceZeroLayout) {
      return handleRaceZeroLayout(race, markdown);
    }
    return handleNonRaceZeroLayout(race, markdown);
  });
}

function handleRaceZeroLayout(race, markdown) {
  // split markdown into questions
  var questions = markdown.split("---").filter((q) => q.trim().length);

  // add questions
  race.questions = questions.map((question, index) => {
    console.log("Handle question " + (index + 1));

    const q = {};
    const headlineAndQandA = question.split("```");

    // add headline and code
    q.headline = headlineAndQandA[0].trim();
    q.code = "```" + headlineAndQandA[1] + "```";

    // add correct answers
    q.correctAnswers = headlineAndQandA[2]
      .match(/Answers\]:?(.+)\*\*/)[1]
      .trim()
      .split(" or ") // NOTE: multiple answer combinations can be correct
      .map((a) => a.split(",").map((a) => a.trim()));

    // add correct answers for display
    q.correctAnswersDisplay = headlineAndQandA[2]
      .match(/Answers\]:?(.+)\*\*/)[1]
      .trim();

    // add answer options
    q.answers = headlineAndQandA[2].match(/\([A-Z]\):.+/g).map((answer) => {
      const letter = answer.match(/\(([A-Z])\)/)[1];
      return {
        letter,
        text: converter.makeHtml(removeBackSlashes(answer)),
      };
    });

    return q;
  });

  // add all correct answers to race
  race.correctAnswers = {};
  race.questions.forEach((question, index) => {
    race.correctAnswers[index] = question.correctAnswers;
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
  race.notes = notesAndCode[0].trim();
  race.code = "```" + notesAndCode[1] + "```";

  // add questions
  const questions = notesCodeAndQuestions.slice(1).map(removeBackSlashes);
  race.questions = questions.map((question, index) => {
    console.log("Handle question " + (index + 1));

    const q = {};
    var headlineAndQandA = question
      .split("\n")
      .map((e) => e.trim())
      .filter((e) => e.length);

    headlineAndQandA = [
      headlineAndQandA[0],
      headlineAndQandA.slice(1, -1).join("\n"),
      headlineAndQandA[headlineAndQandA.length - 1],
    ];

    // add headline
    q.headline = headlineAndQandA[0].trim();

    // add correct answers
    q.correctAnswers = headlineAndQandA[2]
      .match(/Answers\]:?(.+)\*\*/)[1]
      .trim()
      .split(" or ")
      .map((a) => a.split(",").map((a) => a.trim()));

    // add correct answers for display
    q.correctAnswersDisplay = headlineAndQandA[2]
      .match(/Answers\]:?(.+)\*\*/)[1]
      .trim();

    // add answer options
    const answers = headlineAndQandA[1].split("\n");
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
      };
    });

    return q;
  });

  // add all correct answers to race
  race.correctAnswers = {};
  race.questions.forEach((question, index) => {
    race.correctAnswers[index] = question.correctAnswers;
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
  var indexPage = "<html><body><h1>Secureum RACEs</h1><ul>";
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

  // store correct answers
  var correctAnswers = ${JSON.stringify(race.correctAnswers)};

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
    // get validation result
    var results = validate();
    var keys = Object.keys(results);

    // highlight all questions
    var failedQuestionsCount = 0;
    keys.forEach(key => {
      var question = document.getElementById("question_" + key);
      if (results[key] === true) {
        question.className = "success";
      } else {
        question.className = "failure";
        failedQuestionsCount++;
      }
    });

    // reveal answers for all questions
    var answerDisplays = document.getElementsByClassName("hide");
    while (answerDisplays && answerDisplays.length) {
      answerDisplays[0].className = "";
    }
    
    // show alert
    var questionsCount = keys.length;
    var correctPercentage = Math.floor(((questionsCount - failedQuestionsCount)/questionsCount) * 100);
    alert(questionsCount - failedQuestionsCount + " OF " + questionsCount + " QUESTIONS ANSWERED CORRECTLY (" + correctPercentage + "%)");
  }
 
  function validate() {
    // check if all questions were answered
    var unansweredQuestions = getUnansweredQuestions();

    // handle result
    if (unansweredQuestions.length) {
      alert("QUESTIONS " + unansweredQuestions + " WERE NOT ANSWERED!");
      return;
    }

    // validate all checkboxes and format answers
    var invalidAnsweredQuestions = [];
    var inputs = document.getElementsByTagName("input");

    // get checkbox answers grouped per question
    var groupedAnswers = {};
    for(var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      if(input.type == "checkbox") {
        var name = input.name;

        // make sure to have an entry even if no checkbox checked for question
        if (groupedAnswers[name] === undefined)  {
          groupedAnswers[name] = [];
        }

        // collect the chosen answer options
        if (input.checked) {
          groupedAnswers[name].push(input.getAttribute("letter"));
        }
      }
    }

    // compare grouped answers against correct answer option combinations
    var results = {};

    var keys = Object.keys(groupedAnswers);
    for(var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var groupedAnswer = groupedAnswers[key];
      var correctAnswer = correctAnswers[key];
      correctAnswer.forEach((answer, index) => {
        if (Object.keys(results).includes(key)) {
          return;
        }

        var correct = answer.length === groupedAnswer.length && groupedAnswer.every(a => answer.includes(a));
        if (correct) {
          results[key] = true;
        } else if (index + 1 === correctAnswer.length) {
          results[key] = false;
        }
      });
    }

    return results;
  }

  function getUnansweredQuestions() {
    var inputs = document.getElementsByTagName("input");

    // count the number of checked checkboxes per question
    var checkedCount = {};
    for(var i = 0; i < inputs.length; i++) {
        var input = inputs[i];
        if(input.type == "checkbox") {
            var number = parseInt(input.name) + 1; //NOTE: Already preparing for display
            if (!checkedCount[number]) {
                checkedCount[number] = 0;
            }
            checkedCount[number] += input.checked ? 1 : 0;
        }
    }

    // collect all questions that were not answered
    const unansweredQuestions = [];
    for (var [key, value] of Object.entries(checkedCount)) {
        if (value === 0) {
            unansweredQuestions.push(key);
        }
    }
    return unansweredQuestions;
  }

  </script>

  <style>
    .hide { display: none; }
    .success { border: 4px solid #008000; }
    .failure { border: 4px solid red; }
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
  quizzPage += "<br /><br />";

  if (layout !== "race_zero_layout") {
    quizzPage += converter.makeHtml(race.code);
  }

  // questions
  race.questions.forEach((question, x) => {
    quizzPage += `<div id="question_${x}">`;

    quizzPage += converter.makeHtml(question.headline);
    if (layout === "race_zero_layout") {
      quizzPage += converter.makeHtml(question.code);
    }

    question.answers.forEach((answer, i) => {
      const id = `${x}_${i}`;
      if (i !== 0) {
        quizzPage += "<br/>";
      }
      const label = converter.makeHtml(answer.text).slice(3, -4).trim(); // NOTE: Slice removes the surrounding "p" tags
      quizzPage += `<label><input type="checkbox" name="${x}" letter="${answer.letter}" "id="${id}">${label}</label>`;
    });

    quizzPage += `<br/><br/><span class="hide">Correct Answers: ${question.correctAnswersDisplay}</span>`;

    quizzPage += `</div>`;

    if (x < race.questions.length - 1) {
      quizzPage += "<hr/>";
    }
  });

  // validation button
  quizzPage += `<br/><input type="submit" value="VALIDATE ANSWERS" onclick="clickValidateQuestionsButton()"/>`;

  // close page
  quizzPage += "</body></html>";

  // write page to file
  fs.writeFileSync(`./quizzes/race_${race.number}.html`, quizzPage);
}
