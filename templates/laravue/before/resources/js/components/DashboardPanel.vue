<template>
  <section>{{ title }}</section>
</template>

<script setup lang="ts">
import { fetchDashboardItems } from "../services/dashboard.service";

const title = "Dashboard";
void fetchDashboardItems();
</script>
