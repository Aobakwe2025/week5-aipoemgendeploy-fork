const API_BASE_URL = 'https://week5-aipoemgendeploy-fork-f6d0cxggdagac9gw.southafricanorth-01.azurewebsites.net/api';

let soulScriptFormElement = document.querySelector("#form-group");
soulScriptFormElement.addEventListener("submit", generateSoulPoem);

function generateSoulPoem(event) {
  event.preventDefault();

  let userInputElement = document.querySelector("#user-input-feelings");
  let poemElement = document.querySelector("#poem");
  let userInput = userInputElement.value.trim();

  // Validation
  if (!userInput) {
    poemElement.innerHTML = "Please share what you'd like affirmation for! 🌟";
    return;
  }

  // Show loading animation
  new Typewriter("#poem", {
    strings: "Writing your soul affirmation... 🫧🐚🔮",
    autoStart: true,
    delay: 20,
    cursor: "",
  });

  // Call backend API
  fetch(`${API_BASE_URL}/generate-poem`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userInput: userInput,
      theme: "soulscript",
    }),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((err) => {
          throw new Error(err.error || "Failed to generate poem");
        });
      }
      return response.json();
    })
    .then((data) => {
      displayPoem(data.poem);
    })
    .catch((error) => {
      console.error("Error:", error);
      poemElement.innerHTML = `
      <em style="color: #e74c3c;">
        ❌ ${error.message}<br><br>
        Please try again or contact support if the issue persists.
      </em>
    `;
    });
}

function displayPoem(poemText) {
  const poemElement = document.querySelector("#poem");

  // Format the poem with line breaks
  const formattedPoem = poemText.replace(/\n/g, "<br>");

  // Display with typewriter effect
  new Typewriter("#poem", {
    strings: formattedPoem,
    autoStart: true,
    delay: 20,
    cursor: "",
  });
}

