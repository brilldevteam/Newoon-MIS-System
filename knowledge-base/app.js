(function () {
  const topics = window.AML_COMPASS_TOPICS;
  const guides = window.AML_COMPASS_GUIDES;
  const topicGrid = document.getElementById('topic-grid');
  const guideGrid = document.getElementById('guide-grid');
  const search = document.getElementById('guide-search');
  const count = document.getElementById('result-count');
  const clearFilter = document.getElementById('clear-filter');
  const empty = document.getElementById('empty-state');
  let activeTopic = '';

  topicGrid.innerHTML = topics.map((topic) => `<button class="topic-card" type="button" data-topic="${topic.id}"><span>${topic.code}</span><h3>${topic.title}</h3><p>${topic.description}</p><strong>→</strong></button>`).join('');

  function renderGuides() {
    const term = search.value.trim().toLowerCase();
    const filtered = guides.filter((guide) => {
      const matchesTopic = !activeTopic || guide.topic === activeTopic;
      const haystack = `${guide.title} ${guide.summary} ${guide.topic} ${guide.sections.map((section) => `${section.title} ${(section.body || []).join(' ')} ${(section.steps || []).join(' ')}`).join(' ')}`.toLowerCase();
      return matchesTopic && (!term || haystack.includes(term));
    });
    const topicName = topics.find((topic) => topic.id === activeTopic)?.title;
    count.textContent = activeTopic ? `${filtered.length} guide${filtered.length === 1 ? '' : 's'} in ${topicName}` : `Showing ${filtered.length} published guides`;
    clearFilter.hidden = !activeTopic;
    empty.hidden = Boolean(filtered.length);
    guideGrid.hidden = !filtered.length;
    guideGrid.innerHTML = filtered.map((guide) => {
      const topic = topics.find((item) => item.id === guide.topic);
      return `<a class="guide-card" href="article.html?id=${guide.id}"><div class="guide-meta"><span>${topic.title}</span><span>${guide.time}</span></div><h3>${guide.title}</h3><p>${guide.summary}</p><strong>Read guide →</strong></a>`;
    }).join('');
  }

  topicGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-topic]');
    if (!button) return;
    activeTopic = button.dataset.topic;
    topicGrid.querySelectorAll('.topic-card').forEach((item) => item.classList.toggle('active', item === button));
    renderGuides();
    document.querySelector('.guides-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  search.addEventListener('input', renderGuides);
  clearFilter.addEventListener('click', () => { activeTopic = ''; topicGrid.querySelectorAll('.active').forEach((item) => item.classList.remove('active')); renderGuides(); });
  document.getElementById('reset-search').addEventListener('click', () => { search.value = ''; activeTopic = ''; topicGrid.querySelectorAll('.active').forEach((item) => item.classList.remove('active')); renderGuides(); search.focus(); });
  document.addEventListener('keydown', (event) => { if (event.key === '/' && document.activeElement !== search) { event.preventDefault(); search.focus(); } });
  renderGuides();
})();
