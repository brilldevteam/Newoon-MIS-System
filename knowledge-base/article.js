(function () {
  const topics = window.AML_COMPASS_TOPICS;
  const guides = window.AML_COMPASS_GUIDES;
  const id = new URLSearchParams(window.location.search).get('id') || guides[0].id;
  const index = Math.max(0, guides.findIndex((guide) => guide.id === id));
  const guide = guides[index];
  const topic = topics.find((item) => item.id === guide.topic);
  document.title = `${guide.title} | AML Compass`;
  document.getElementById('topic-crumb').textContent = topic.title;
  document.getElementById('article-crumb').textContent = guide.title;
  document.getElementById('article-topic').textContent = topic.title;
  document.getElementById('article-time').textContent = `${guide.time} read`;
  document.getElementById('article-title').textContent = guide.title;
  document.getElementById('article-summary').textContent = guide.summary;
  document.getElementById('article-sections').innerHTML = guide.sections.map((section, sectionIndex) => {
    const body = (section.body || []).map((paragraph) => `<p>${paragraph}</p>`).join('');
    const steps = section.steps ? `<ol>${section.steps.map((step) => `<li>${step}</li>`).join('')}</ol>` : '';
    const callout = section.callout ? `<aside class="article-callout"><strong>Important</strong><p>${section.callout}</p></aside>` : '';
    return `<section id="section-${sectionIndex + 1}"><h2>${section.title}</h2>${body}${steps}${callout}</section>`;
  }).join('');
  document.getElementById('article-toc').innerHTML = guide.sections.map((section, sectionIndex) => `<a href="#section-${sectionIndex + 1}">${section.title}</a>`).join('');

  const tocLinks = [...document.querySelectorAll('#article-toc a')];
  const sections = [...document.querySelectorAll('#article-sections section')];
  function activateSection(sectionId) {
    tocLinks.forEach((link) => {
      const isActive = link.getAttribute('href') === `#${sectionId}`;
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  if (sections.length) activateSection(sections[0].id);
  function syncActiveSection() {
    const readingLine = Math.min(window.innerHeight * 0.45, 430);
    const current = sections.reduce((active, section) => (
      section.getBoundingClientRect().top <= readingLine ? section : active
    ), sections[0]);
    if (current) activateSection(current.id);
  }
  const sectionObserver = new IntersectionObserver(syncActiveSection, {
    rootMargin: '-18% 0px -66% 0px',
    threshold: 0
  });
  sections.forEach((section) => sectionObserver.observe(section));
  let scrollTicking = false;
  window.addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(() => {
      syncActiveSection();
      scrollTicking = false;
    });
  }, { passive: true });

  function setPager(elementId, target, prefix) {
    const element = document.getElementById(elementId);
    if (!target) { element.hidden = true; return; }
    element.href = `article.html?id=${target.id}`;
    element.innerHTML = `<small>${prefix}</small><strong>${target.title}</strong>`;
  }
  setPager('previous-guide', guides[index - 1], 'Previous guide');
  setPager('next-guide', guides[index + 1], 'Next guide');
  document.querySelectorAll('[data-feedback]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-feedback]').forEach((item) => item.disabled = true);
    button.closest('.article-feedback').querySelector('strong').textContent = 'Thank you for your feedback.';
  }));
})();
