<template>
  <header class="mag-cover-top cm-cover-top">
    <p class="mag-cover-issue cm-cover-issue">
      <span class="cm-issue-pill">{{ issue }}</span>
      <span class="cm-price-pill">{{ price }}</span>
    </p>
    <h2 class="mag-masthead cm-masthead" :aria-label="title">
      <span class="cm-masthead-sweet">SWEET</span>
      <span class="cm-masthead-tooth">TOOTH</span>
    </h2>
    <p class="mag-cover-strap cm-cover-strap">{{ strap }}</p>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  issue: string;
  price: string;
  title: string;
  strap: string;
}>();
</script>

