const contactForm = document.getElementById("contactForm");
const successMessage = document.getElementById("successMessage");
const errorMessage = document.getElementById("errorMessage");

contactForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Hide previous messages
  successMessage.classList.add("hidden");
  errorMessage.classList.add("hidden");

  const formData = {
    name: document.getElementById("name").value,
    email: document.getElementById("email").value,
    subject: document.getElementById("subject").value,
    message: document.getElementById("message").value
  };

  try {
    const res = await fetch("/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });

    if (res.ok) {
      contactForm.reset();
      successMessage.classList.remove("hidden");
      successMessage.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      throw new Error("Failed to send message");
    }
  } catch (err) {
    errorMessage.classList.remove("hidden");
    errorMessage.scrollIntoView({ behavior: "smooth", block: "center" });
  }
});
