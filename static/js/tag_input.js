// tag_input.js — Shared multi-entry tag widget

function initTagInput(wrapperId, inputId, hiddenId) {
  const wrapper = document.getElementById(wrapperId);
  const input   = document.getElementById(inputId);
  const hidden  = document.getElementById(hiddenId);
  let tags = [];

  function render() {
    // Remove existing tags
    wrapper.querySelectorAll('.tag').forEach(t => t.remove());
    tags.forEach((tag, i) => {
      const el = document.createElement('div');
      el.className = 'tag';
      el.innerHTML = `<span>${tag}</span><button type="button" onclick="removeTag(${i},'${wrapperId}','${inputId}','${hiddenId}')">×</button>`;
      wrapper.insertBefore(el, input);
    });
    hidden.value = JSON.stringify(tags);
  }

  function addTag(val) {
    val = val.trim();
    if (!val || tags.includes(val)) return;
    tags.push(val);
    render();
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input.value.replace(',',''));
      input.value = '';
    }
    if (e.key === 'Backspace' && input.value === '' && tags.length) {
      tags.pop();
      render();
    }
  });

  input.addEventListener('blur', () => {
    if (input.value.trim()) { addTag(input.value); input.value = ''; }
  });

  // expose removeTag globally with key
  window[`removeTag_${wrapperId}`] = function(i) {
    tags.splice(i, 1);
    render();
  };

  // Patch the remove to use wrapper-scoped fn
  window.removeTag = function(i, wId, iId, hId) {
    window[`removeTag_${wId}`](i);
  };

  return { getTags: () => tags };
}
