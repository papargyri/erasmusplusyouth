/* ------------------------------------------------------------
   JAVASCRIPT FUNCTIONALITY
------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Mobile Navigation Toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }

    // Close mobile menu when a link is clicked
    document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    }));

    // 2. Sticky Header Effect
    const header = document.querySelector('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.boxShadow = "0 4px 15px rgba(0,0,0,0.1)";
        } else {
            header.style.boxShadow = "0 2px 10px rgba(0,0,0,0.05)";
        }
    });

    // 3. Contact Form Validation & "Submission"
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent actual page reload
            
            // Basic Validation
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const message = document.getElementById('message').value.trim();

            if(name === "" || email === "" || message === "") {
                alert("Please fill in all required fields.");
                return;
            }

            // Simulation of backend POST
            // TO CONNECT YOUR BACKEND: Replace the code below with a fetch() call to your API.
            // Example: 
            // fetch('https://your-backend-api.com/contact', { method: 'POST', body: ... })
            
            console.log("Form Submitted:", { name, email, message });
            
            // User Feedback
            const btn = contactForm.querySelector('button');
            const originalText = btn.innerText;
            
            btn.innerText = "Message Sent!";
            btn.style.backgroundColor = "#00CC99"; // Success green
            btn.style.color = "#fff";
            
            contactForm.reset();

            // Reset button after 3 seconds
            setTimeout(() => {
                btn.innerText = originalText;
                btn.style.backgroundColor = ""; 
                btn.style.color = "";
            }, 3000);
        });
    }
});