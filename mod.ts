#!/usr/bin/env -S deno run --no-check --allow-read=.env,.env.defaults,. --allow-net=api.twitch.tv

import { colors, config, path } from "./deps.ts";

if (import.meta.main) {
  const streamNames = ["kirinokirino"];

  const dir = Deno.mainModule.split(path.sep).slice(1, -1).join(path.sep);
  const p = path.join(dir, ".env");
  const appClientID = config({ path: p }).appClientID;

  var liveStreams: liveStreamInfo[];
  if (Deno.args[0] === "--help" || Deno.args[0] === "-h") {
    console.log(`
procrastinate
USAGE:
  ./mod.ts [FLAGS][OPTIONS]
FLAGS:
  -h, --help            Prints help information
OPTIONS:
  game [game]           Searches streams by the game
  lang [language]       Searches streams by the language
DEFAULT:
  uses internal StreamNames variable to query twitch if specific channels are streaming.
    `)
    Deno.exit();
  } else if (Deno.args[0] === "game" && Deno.args[1] && !Deno.args[2] ) {
    liveStreams = await getStreams(appClientID, Deno.args[1]);
  } else if (Deno.args[0] === "lang" && Deno.args[1] && !Deno.args[2] ) {
    liveStreams = await getStreams(appClientID, undefined, Deno.args[1]);
  } else if (Deno.args[0] === "lang" && Deno.args[1] && Deno.args[2] === "game" && Deno.args[3]) {
    liveStreams = await getStreams(appClientID, Deno.args[3], Deno.args[1]);
  } else if (Deno.args[0] === "game" && Deno.args[1] && Deno.args[2] === "lang" && Deno.args[3]) {
    liveStreams = await getStreams(appClientID, Deno.args[1], Deno.args[3]);
  } else {
    liveStreams = await getTwitchStreamsByIds(
      appClientID,
      streamNames,
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

// Generic get streams function
async function getStreams(
  appClientID: string,
  game?: string,
  language?: string,
  page?: number,
): Promise<liveStreamInfo[]> {
  const acceptVersion = "application/vnd.twitchtv.v5+json";
  const gameParameter = game ? "game=" + game : "";
  const languageParameter = language ? "language=" + language : "";
  const offsetParameter = page ? "offset=" + page * 100 : "";
  const parameters = [gameParameter, languageParameter, offsetParameter];
  const url =
    "https://api.twitch.tv/kraken/streams?limit=100&stream_type=live&" +
    parameters.join("&");
  return await fetch(url, {
    headers: {
      "Client-ID": appClientID,
      "Accept": acceptVersion,
      "Content-Type": "application/json",
    },
  }).then(function (response) {
    if (response.status !== 200) {
      throw Error(response.status + ": " + response.statusText);
    }
    return response.json();
  }).then(function (json) {
    const liveStreams: liveStreamInfo[] = [];
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
}

// Get streams specific to channel ids
async function getTwitchStreamsByIds(
  appClientID: string,
  channels: string[],
): Promise<liveStreamInfo[]> {
  const acceptVersion = "application/vnd.twitchtv.v5+json";
  const ids = await getTwitchIds(appClientID, channels);
  if (ids.length < 1) throw Error("Got no ids!");

  var urls: string[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    urls.push(
      "https://api.twitch.tv/kraken/streams?limit=100&channel=" +
        ids.slice(i, i + 99),
    );
  }

  var liveStreams: liveStreamInfo[] = [];
  while (true) {
    const url = urls.pop();
    if (typeof url === "undefined") break;
    liveStreams = liveStreams.concat(
      await fetch(url, {
        headers: {
          "Client-ID": appClientID,
          "Accept": acceptVersion,
          "Content-Type": "application/json",
        },
      }).then(function (response) {
        if (response.status !== 200) {
          throw Error(response.status + ": " + response.statusText);
        }
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
      }),
    );
  }
  return liveStreams;
}

// User to IDs
async function getTwitchIds(
  appClientID: string,
  channels: string[],
): Promise<string[]> {
  const acceptVersion = "application/vnd.twitchtv.v5+json";
  if (channels.length < 1) channels.push("kirinokirino"); // Kappa
  var urls: string[] = [];
  for (let i = 0; i < channels.length; i += 100) {
    urls.push(
      "https://api.twitch.tv/kraken/users/?login=" + channels.slice(i, i + 99),
    );
  }

  var ids: string[] = [];
  while (true) {
    const url = urls.pop();
    if (typeof url === "undefined") break;
    const newIds = await fetch(url, {
      headers: {
        "Client-ID": appClientID,
        "Accept": acceptVersion,
        "Content-Type": "application/json",
      },
    }).then(function (response) {
      if (response.status !== 200) {
        throw Error(response.status + ": " + response.statusText);
      }
      return response.json();
    }).then(function (json) {
      const ids: string[] = [];
      for (const user of json.users) {
        ids.push(user._id as string);
      }
      return ids;
    });

    ids = ids.concat(newIds);
  }

  return ids;
}
