const data = JSON.stringify({
  name: "Hasini Test",
  email: "srikanthfreelancer2170@gmail.com",
  phone: "9876543210",
  subject: "Mathematics",
  qualification: "M.Sc, B.Ed",
  experience: "5-10 Years",
  message: "I am highly passionate about teaching and eager to contribute to the academic excellence at St. Martins Group of Schools."
});

fetch("http://localhost:5000/api/teacher-requests/submit", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: data
})
.then(res => res.json())
.then(d => console.log("RESPONSE:", JSON.stringify(d, null, 2)))
.catch(e => console.error("ERROR:", e.message));
