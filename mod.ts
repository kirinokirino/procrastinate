#!/usr/bin/env -S deno run --no-check --allow-read=.env,.env.defaults,. --allow-net=api.twitch.tv

import { colors, config, path } from "./deps.ts";

if (import.meta.main) {
  const streamNames = ["kirinokirino"];

  let liveStreams: liveStreamInfo[] = [];
  for (let i = 0; i < streamNames.length; i += 10) {
    liveStreams = liveStreams.concat(
      await getTwitchStreams(streamNames.slice(i, i + 9)),
    );
  }

  if (liveStreams.length < 1) console.log("Currently noone is streaming :(");
  else {
    for (const stream of liveStreams) {
      if (stream.game !== undefined) {
        console.log(
          colors.red(colors.bold(stream.display_name)) + " is playing " +
            colors.black(colors.bold(stream.game)) + " with " +
            colors.blue(String(stream.viewers)) + " viewers.",
        );
      } else {
        console.log(
          colors.red(colors.bold(stream.display_name)) +
            " is doing something with " +
            colors.blue(String(stream.viewers)) + " viewers.",
        );
      }
      console.log(colors.bold(stream.url));
      console.log(stream.status);
      console.log("");
    }
  }
}

interface liveStreamInfo {
  // deno-lint-ignore camelcase
  display_name: string;
  game?: string;
  viewers: number;
  status?: string;
  url: string;
  // deno-lint-ignore camelcase
  stream_type: string;
}

// Get streams
async function getTwitchStreams(channels: string[]): Promise<liveStreamInfo[]> {
  const dir = Deno.mainModule.split(path.sep).slice(1, -1).join(path.sep);
  const p = path.join(dir, ".env");
  const appClientID = config({ path: p }).appClientID;
  const acceptVersion = "application/vnd.twitchtv.v5+json";
  const ids = await getTwitchIds(appClientID, channels);
  if (ids.length < 1) throw Error("Got no ids!");
  const url = "https://api.twitch.tv/kraken/streams?limit=100&channel=" + ids;

  const liveStreams: liveStreamInfo[] = await fetch(url, {
    headers: {
      "Client-ID": appClientID,
      "Accept": acceptVersion,
      "Content-Type": "application/json",
    },
  }).then(function (response) {
    return response.json();
  }).then(function (json) {
    const liveStreams = [];
    for (const stream of json.streams) {
      if (stream.stream_type === "live") {
        liveStreams.push({
          display_name: stream.channel.display_name,
          game: stream.game,
          viewers: stream.viewers,
          status: stream.channel.status,
          url: stream.channel.url,
          stream_type: stream.stream_type,
        } as liveStreamInfo);
      }
    }
    return liveStreams;
  }).catch(function (exception) {
    console.log("parsing failed", exception);
    return [];
  });
  return liveStreams;
}

// User to IDs
async function getTwitchIds(
  appClientID: string,
  channels: string[],
): Promise<string[]> {
  const acceptVersion = "application/vnd.twitchtv.v5+json";
  if (channels.length < 1) channels.push("kirinokirino"); // Kappa
  var url = "https://api.twitch.tv/kraken/users/?login=" + channels;

  const ids: string[] = await fetch(url, {
    headers: {
      "Client-ID": appClientID,
      "Accept": acceptVersion,
      "Content-Type": "application/json",
    },
  }).then(function (response) {
    return response.json();
  }).then(function (json) {
    const ids: string[] = [];
    for (const user of json.users) {
      ids.push(user._id as string);
    }
    return ids;
  }).catch(function (exception) {
    console.error("parsing failed", exception);
    return [];
  });
  return ids;
}
