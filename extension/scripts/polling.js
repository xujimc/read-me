(async () => {
    console.log("ran the polling script")
    const rss = await (await fetch("https://blog.google/rss/")).json()
    console.log(rss);
})()