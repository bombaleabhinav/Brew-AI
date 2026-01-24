const form = document.getElementById("ideaForm");
const loader = document.getElementById("loader");
const results = document.getElementById("results");

/* ✅ ADD */
const overlay = document.getElementById("overlay");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  loader.classList.remove("hidden");
  results.classList.add("hidden");

  /* ✅ ADD */
  overlay.classList.remove("hidden");

  const payload = {
    Domain: Domain.value,
    PS: PS.value,
    Solution: Solution.value,
    TargetUsers: TargetUsers.value,
    Guidelines: Guidelines.value
  };

  try {
    const res = await fetch("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    Object.keys(data).forEach(key => {
      document.getElementById(key).innerText = data[key];
    });

    loader.classList.add("hidden");
    results.classList.remove("hidden");

    /* ✅ ADD */
    overlay.classList.add("hidden");
    results.scrollIntoView({ behavior: "smooth" });

  } catch {
    loader.classList.add("hidden");

    /* ✅ ADD */
    overlay.classList.add("hidden");

    alert("Evaluation failed");
  }
});
