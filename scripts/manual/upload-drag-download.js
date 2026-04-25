async page => {
  await page.setContent(`
    <input id="f" type="file">
    <div id="name"></div>
    <script>
      document.getElementById('f').addEventListener('change', e => {
        document.getElementById('name').textContent = e.target.files[0]?.name || '';
      });
    </script>

    <div id="src" draggable="true">drag me</div>
    <div id="dst">drop here</div>
    <script>
      const src = document.getElementById('src');
      const dst = document.getElementById('dst');
      src.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', 'dragged'));
      dst.addEventListener('dragover', e => e.preventDefault());
      dst.addEventListener('drop', e => {
        e.preventDefault();
        dst.textContent = e.dataTransfer.getData('text/plain');
      });
    </script>

    <a id="dl" download="sample.txt" href="data:text/plain,hello">Download</a>
  `);

  return 'ready';
}
