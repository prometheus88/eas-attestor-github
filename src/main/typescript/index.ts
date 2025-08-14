export function main(): void {
    console.log("Hello from TypeScript!");
}

// ES module equivalent of require.main === module
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
