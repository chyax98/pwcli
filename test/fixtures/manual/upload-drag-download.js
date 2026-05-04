async (page) => {
  await page.setContent(`
    <input id="f" type="file">
    <div id="name"></div>
    <div id="events" data-change="0" data-input="0"></div>
    <script>
      document.getElementById('f').addEventListener('input', () => {
        document.getElementById('events').dataset.input = String(Number(document.getElementById('events').dataset.input) + 1);
      });
      document.getElementById('f').addEventListener('change', e => {
        document.getElementById('events').dataset.change = String(Number(document.getElementById('events').dataset.change) + 1);
        document.getElementById('name').textContent = e.target.files[0]?.name || '';
      });
    </script>

    <div id="src" draggable="true">drag me</div>
    <div id="dst" data-dropped="0">drop here</div>
    <script>
      const dragSourceEl = document.getElementById('src');
      const dropTargetEl = document.getElementById('dst');
      dragSourceEl.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', 'dragged'));
      dropTargetEl.addEventListener('dragover', e => e.preventDefault());
      dropTargetEl.addEventListener('drop', e => {
        e.preventDefault();
        dropTargetEl.dataset.dropped = '1';
        dropTargetEl.textContent = e.dataTransfer.getData('text/plain') || 'dropped';
      });
    </script>

    <a id="dl" download="sample.txt" href="data:text/plain,hello">Download</a>
  `);

  return "ready";
};
