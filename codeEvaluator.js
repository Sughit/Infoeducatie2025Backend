const express = require('express');
const fs = require('fs');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const app = express();

app.use(express.json());

app.post('/evaluate', (req, res) => {
  const { code, testCases } = req.body;
  if (!code || !Array.isArray(testCases)) {
    return res.status(400).json({ error: 'Codul sau testele lipsesc' });
  }

  const fileId = uuidv4();
  const filePath = `/tmp/${fileId}.cpp`;
  const exePath = `/tmp/${fileId}.out`;

  fs.writeFileSync(filePath, code);

  exec(`g++ ${filePath} -o ${exePath}`, (compileErr, _, compileStderr) => {
    if (compileErr) {
      return res.status(400).json({ error: 'Eroare la compilare', details: compileStderr });
    }

    let passed = 0;
    const results = [];

    const runTest = (i) => {
      if (i >= testCases.length) {
        return res.json({
          total: testCases.length,
          passed,
          results,
          score: `${passed} / ${testCases.length}`
        });
      }

      const { input, output: expected } = testCases[i];

      exec(`${exePath}`, { input, timeout: 3000 }, (err, stdout, stderr) => {
        const actual = (stdout || stderr || '').trim();
        const ok = actual === expected.trim();
        if (ok) passed++;
        results.push({ input, expected: expected.trim(), output: actual, passed: ok });
        runTest(i + 1);
      });
    };

    runTest(0);
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Evaluator rulează pe portul ${PORT}`));
