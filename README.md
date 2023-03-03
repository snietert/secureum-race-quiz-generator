# Secureum RACE quiz generator

Generate quizzes from all past Secureum RACEs that allow you to train them completely _offline_. A new RACEs is currently published every few weeks.

**To get started execute:**

```
git clone https://github.com/snietert/secureum-race-quiz-generator
cd secureum-race-quiz-generator
yarn
git clone git@github.com:secureum/RACE.git
node index.js
open quizzes/index.html
```

**To get new quizzes**

```
cd secureum-race-quiz-generator
cd RACE
git pull
cd ..
node index.js
open quizzes/index.html
```
