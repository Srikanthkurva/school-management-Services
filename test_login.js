async function testLogin(identifier, password, userType, label) {
  try {
    const res = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password, userType })
    });
    const data = await res.json();
    console.log(`[${label}] Status: ${res.status}, Response:`, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`[${label}] FETCH ERROR:`, e.message);
  }
}

(async () => {
  await testLogin("superadmin@gmail.com", "password123", "admin", "Admin Login");
  await testLogin("teacher@schoolsaas.com", "password123", "teacher", "Teacher Login");
  await testLogin("student@schoolsaas.com", "password123", "parent", "Parent Login");
})();
