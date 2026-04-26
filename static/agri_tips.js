function setActive(el) {
  document.querySelectorAll('.toc-item').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

// Back to top button
window.addEventListener('scroll', () => {
  const btn = document.getElementById('backTop');
  if (window.scrollY > 400) btn.classList.add('visible');
  else btn.classList.remove('visible');
  // Update active TOC item based on scroll position
  const sections = document.querySelectorAll('.section-block');
  let current = '';
  sections.forEach(s => {
    if (window.scrollY >= s.offsetTop - 100) current = s.id;
  });
  document.querySelectorAll('.toc-item').forEach(t => {
    t.classList.remove('active');
    if (t.getAttribute('href') === '#' + current) t.classList.add('active');
  });
});

// Search filter
function filterSections() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  document.querySelectorAll('.section-block').forEach(section => {
    const text = section.textContent.toLowerCase();
    section.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
}

// Hash navigation on load
window.addEventListener('DOMContentLoaded', () => {
  const hash = window.location.hash;
  if (hash) {
    setTimeout(() => {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({behavior:'smooth'});
      const tocLink = document.querySelector(`.toc-item[href="${hash}"]`);
      if (tocLink) setActive(tocLink);
    }, 300);
  }
});