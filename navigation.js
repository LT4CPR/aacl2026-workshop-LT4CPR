(() => {
  const bar = document.querySelector('.hero-nav-bar');
  const links = [...document.querySelectorAll('.nav a[href^="#"]')];
  const sections = links.map(link => document.querySelector(link.getAttribute('href')));
  if (!bar || sections.some(section => !section)) return;

  function updateActiveLink() {
    const threshold = bar.getBoundingClientRect().height + 32;
    let current = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= threshold) current = section;
    }
    for (const link of links) {
      const active = link.hash === `#${current.id}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--nav-height', `${bar.offsetHeight}px`);
    updateActiveLink();
  }).observe(bar);
  let pending = false;
  window.addEventListener('scroll', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { updateActiveLink(); pending = false; });
  }, { passive: true });
  updateActiveLink();
})();
