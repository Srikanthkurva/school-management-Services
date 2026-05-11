
fetch('http://localhost:5000/api/teacher-requests/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Test Teacher',
    email: 'srikanthfreelancer2170@gmail.com',
    phone: '1234567890',
    subject: 'Math',
    qualification: 'B.Ed',
    experience: '2 Years',
    message: 'Hello'
  })
})
.then(res => res.json())
.then(data => console.log('Response:', data))
.catch(err => console.error('Error:', err));

