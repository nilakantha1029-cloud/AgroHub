// AgriConnect - Interactive JavaScript

// ===================================
// Mobile Menu Toggle
// ===================================
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const navMenu = document.getElementById("navMenu");

if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener("click", () => {
    navMenu.classList.toggle("active");
    mobileMenuBtn.classList.toggle("active");
  });
}

// Close mobile menu when clicking on a link
const navLinks = document.querySelectorAll(".nav-link");
navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navMenu.classList.remove("active");
    mobileMenuBtn.classList.remove("active");
  });
});


const navbar = document.getElementById("navbar");

if (navbar) {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  });
}

// ===================================
// Services Tabs
// ===================================
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetTab = button.getAttribute("data-tab");

    // Remove active class from all buttons and contents
    tabButtons.forEach((btn) => btn.classList.remove("active"));
    tabContents.forEach((content) => content.classList.remove("active"));

    // Add active class to clicked button and corresponding content
    button.classList.add("active");
    document.getElementById(targetTab).classList.add("active");
  });
});

// ===================================
// Contact Form Handling
// ===================================
const contactForm = document.getElementById("contactForm");

if (contactForm) {
  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    let isFormValid = true;
    const inputs = contactForm.querySelectorAll("input, textarea, select");
    inputs.forEach((input) => {
      if (!validateInput(input)) isFormValid = false;
    });
    if (!isFormValid) {
      showNotification("Please fix errors before submitting!", "error");
      return;
    }

    const submitBtn = contactForm.querySelector("button[type=submit]");
    submitBtn.textContent = "Sending…";
    submitBtn.disabled = true;

    const formData = new FormData(contactForm);
    const data = {};
    formData.forEach((value, key) => { data[key] = value; });

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        showNotification("✅ Message sent! We'll get back to you soon.", "success");
        contactForm.reset();
      } else {
        showNotification(result.error || "Failed to send message.", "error");
      }
    } catch (err) {
      showNotification("Network error. Please try again.", "error");
    } finally {
      submitBtn.textContent = "Send Message";
      submitBtn.disabled = false;
    }
  });
}

// ===================================
// Notification System
// ===================================
function showNotification(message, type = "info") {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.textContent = message;

  // Add styles
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 24px;
    background: ${type === "success" ? "#2d6a4f" : "#f4a259"};
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(45, 106, 79, 0.16);
    z-index: 10000;
    animation: slideInRight 0.4s ease;
    max-width: 400px;
  `;

  document.body.appendChild(notification);

  // Remove after 4 seconds
  setTimeout(() => {
    notification.style.animation = "slideOutRight 0.4s ease";
    setTimeout(() => {
      notification.remove();
    }, 400);
  }, 4000);
}

// Add notification animations
const style = document.createElement("style");
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// ===================================
// Smooth Scroll for Anchor Links
// ===================================
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    const href = this.getAttribute("href");

    // Skip if href is just "#" or links to login/signup
    if (href === "#" || href === "#login" || href === "#signup") {
      return;
    }

    e.preventDefault();
    let target = null;
    try {
      target = document.querySelector(href);
    } catch (e) {
      return;
    }

    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});

// ===================================
// Scroll Animations (Simple AOS)
// ===================================
const observerOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -100px 0px",
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = "1";
      entry.target.style.transform = "translateY(0)";
    }
  });
}, observerOptions);

// Observe elements with data-aos attribute
document.querySelectorAll("[data-aos]").forEach((el) => {
  el.style.opacity = "0";
  el.style.transform = "translateY(30px)";
  el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
  observer.observe(el);
});

// ===================================
// Counter Animation for Stats
// ===================================
function animateCounter(element, target, duration = 2000) {
  if (!target || target === 0) { element.textContent = '0'; return; }
  const increment = target / (duration / 16);
  let current = 0;
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      element.textContent = formatNumber(target);
      clearInterval(timer);
    } else {
      element.textContent = formatNumber(Math.floor(current));
    }
  }, 16);
}

function formatNumber(num) {
  if (num >= 10000000) return '₹' + (num / 10000000).toFixed(1) + 'Cr+';
  if (num >= 100000)   return (num / 100000).toFixed(1) + 'L+';
  if (num >= 1000)     return num.toLocaleString('en-IN') + '+';
  return num.toString();
}

// Animate counters when hero stats come into view
// ===================================
// Live Stats from API
// ===================================
async function loadLandingStats() {
  try {
    const res  = await fetch('/api/landing-stats');
    const data = await res.json();

    const map = {
      'stat-farmers':   data.active_farmers,
      'stat-customers': data.total_customers,
      'stat-orders':    data.total_orders,
      'stat-storage':   data.storage_units,
      'stat-equipment': data.equipment_units,
    };

    for (const [id, value] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) animateCounter(el, value, 1800);
    }
  } catch (e) {
    console.warn('Could not load landing stats:', e);
  }
}

loadLandingStats();

// ===================================
// Button Click Effects
// ===================================
document.querySelectorAll(".btn").forEach((button) => {
  button.addEventListener("click", function (e) {
    // Create ripple effect
    const ripple = document.createElement("span");
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.5);
      left: ${x}px;
      top: ${y}px;
      transform: scale(0);
      animation: ripple 0.6s ease-out;
      pointer-events: none;
    `;

    this.style.position = "relative";
    this.style.overflow = "hidden";
    this.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
  });
});

// Add ripple animation
const rippleStyle = document.createElement("style");
rippleStyle.textContent = `
  @keyframes ripple {
    to {
      transform: scale(2);
      opacity: 0;
    }
  }
`;
document.head.appendChild(rippleStyle);

// ===================================
// Feature Cards Hover Effect
// ===================================
const featureCards = document.querySelectorAll(
  ".feature-card, .benefit-card, .step-card",
);

featureCards.forEach((card) => {
  card.addEventListener("mouseenter", function () {
    this.style.zIndex = "10";
  });

  card.addEventListener("mouseleave", function () {
    this.style.zIndex = "1";
  });
});

// ===================================
// Parallax Effect for Hero Background
// ===================================
window.addEventListener("scroll", () => {
  const scrolled = window.pageYOffset;
  const heroPattern = document.querySelector(".hero-pattern");

  if (heroPattern && scrolled < window.innerHeight) {
    heroPattern.style.transform = `translateY(${scrolled * 0.5}px)`;
  }
});

// ===================================
// Form Validation
// ===================================
const inputs = document.querySelectorAll("input, textarea, select");

inputs.forEach((input) => {
  input.addEventListener("blur", function () {
    validateInput(this);
  });

  input.addEventListener("input", function () {
    if (this.classList.contains("error")) {
      validateInput(this);
    }
  });
});

function validateInput(input) {
  const value = input.value.trim();
  let isValid = true;
  let errorMessage = "";

  if (input.hasAttribute("required") && !value) {
    isValid = false;
    errorMessage = "This field is required";
  }

  if (input.type === "email" && value) {
    const emailRegex =
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(value)) {
      isValid = false;
      errorMessage = "Enter a valid email address (example@domain.com)";
    }
  }

  showFieldError(input, errorMessage, isValid);

  return isValid;
}

// ===================================
// Lazy Loading Images
// ===================================
const imageObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const img = entry.target;

      // fade in safely
      img.style.transition = "opacity 0.6s ease";

      if (img.complete) {
        // already loaded (cached image)
        img.style.opacity = "1";
      } else {
        img.onload = () => {
          img.style.opacity = "1";
        };
      }

      imageObserver.unobserve(img);
    }
  });
});

document.querySelectorAll("img").forEach((img) => {
  img.style.opacity = "0"; // start hidden
  imageObserver.observe(img);
});

// ===================================
// Active Navigation Link
// ===================================
const sections = document.querySelectorAll("section[id]");

window.addEventListener("scroll", () => {
  const scrollY = window.pageYOffset;

  sections.forEach((section) => {
    const sectionHeight = section.offsetHeight;
    const sectionTop = section.offsetTop - 100;
    const sectionId = section.getAttribute("id");
    const navLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);

    if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
      navLinks.forEach((link) => link.classList.remove("active"));
      if (navLink) {
        navLink.classList.add("active");
      }
    }
  });
});

// ===================================
// Performance Optimization
// ===================================
// Debounce function for scroll events
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Use debounced scroll handler
const debouncedScrollHandler = debounce(() => {
  // Your scroll logic here
}, 10);

window.addEventListener("scroll", debouncedScrollHandler);

// ===================================
// Console Welcome Message
// ===================================
console.log(
  "%cAgriConnect 🌾",
  "color: #2d6a4f; font-size: 24px; font-weight: bold;",
);
console.log(
  "%cTransforming Agriculture Through Technology",
  "color: #40916c; font-size: 14px;",
);
console.log("%cBuilt with ❤️ by Quadrons", "color: #6c757d; font-size: 12px;");

// ===================================
// Page Load Animation
// ===================================
window.addEventListener("load", () => {
  document.body.style.opacity = "0";
  setTimeout(() => {
    document.body.style.transition = "opacity 0.6s ease";
    document.body.style.opacity = "1";
  }, 100);
});

// ===================================
// Easter Egg - Konami Code
// ===================================
const konamiCode = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];
let konamiIndex = 0;

document.addEventListener("keydown", (e) => {
  if (e.key === konamiCode[konamiIndex]) {
    konamiIndex++;
    if (konamiIndex === konamiCode.length) {
      showNotification(
        "🎉 You found the secret! 30% discount code: AGRI2026",
        "success",
      );
      konamiIndex = 0;
    }
  } else {
    konamiIndex = 0;
  }
});


function showFieldError(input, message, isValid) {
  let errorEl = input.parentElement.querySelector(".error-text");

  if (!errorEl) {
    errorEl = document.createElement("div");
    errorEl.className = "error-text";
    input.parentElement.appendChild(errorEl);
  }

  if (!isValid) {
    input.classList.add("error");
    input.style.borderColor = "#e63946";
    errorEl.textContent = message;
    errorEl.style.display = "block";
  } else {
    input.classList.remove("error");
    input.style.borderColor = "#52b788";
    errorEl.textContent = "";
    errorEl.style.display = "none";
  }
}

// Admin Login Modal

function openAdminLogin(){document.getElementById('adminLoginModal').style.display='grid'}
async function doAdminLogin(){
  const email=document.getElementById('adm_login_email').value.trim();
  const pass=document.getElementById('adm_login_pass').value;
  const err=document.getElementById('adm_err');
  err.textContent='';
  try{
    const res=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass}),credentials:'include'});
    const d=await res.json();
    if(d.success){window.location.href='/admin'}
    else{err.textContent=d.error||'Invalid credentials'}
  }catch(e){err.textContent='Server error'}
}
