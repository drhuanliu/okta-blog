---
disqus_thread_id: 8089923701
discourse_topic_id: 17258
discourse_comment_url: https://devforum.okta.com/t/17258
layout: blog_post
title: "Deploy a .NET Container with AWS ECS Fargate"
author: chase-aucoin
by: contractor
communities: [.net]
description: "This is a tutorial on how to secure your .NET containerized chat app with AWS Fargate and Okta."
tags: [containers, aws, fargate, c-sharp, csharp, dotnet, dot-net, asp-dot-net, vuejs]
tweets:
  - "Ever messed with AWS Fargate? Learn how to authenticate users to your #dotnetcore #container hosted in #aws ->."
  - "Unsure about #containerized #dotnet with #Fargate in #AWS? We've got a primer just waiting for you ->"
  - "Learn how to create secure .NET #containers in #AWS with Fargate ->"
image: blog/featured/okta-dotnet-mouse-down.jpg
type: conversion
changelog:
  - 2021-12-07: Updated the post to use .NET SDK CLI, latest Okta Admin Console and VueJS 3. Changes to this article can be viewed in [oktadev/okta-blog#958](https://github.com/oktadev/okta-blog/pull/958). Changes to the example application can be viewed in [oktadev/okta-dotnetcore-aws-fargate-example#1](https://github.com/oktadev/okta-dotnetcore-aws-fargate-example/pull/1).
---

In the last article I wrote, we learned [how to host a serverless .NET application using AWS Lambda](/blog/2020/06/08/serverless-lambda-functions-csharp). In the article, we talked about the history of serverless and how companies are using these types of technology to simplify delivering APIs and functionality faster than traditional methods. Some problems will arise in this type of application when you need more capability than your standard HTTP requests like GET, POST, PUT, DELETE, etc. A great example of this is Web Sockets.

{% include toc.md %}

## Understanding Containers vs. Virtual Machines

Around 2013, [Docker](https://www.docker.com/) was released, and with it began a shift in how we think about hosting applications and managing infrastructure. Infrastructure teams and operations have been leveraging Virtual Machines with great success for decades, so you may be tempted to think, "isn't this just a virtual machine?" In spirit, yes, in application no.

To talk about containers, we have to talk about Virtual Machines. A virtual machine is a virtual representation of a computer all the way from its boot process to loading an entire operating system. This provides a lot of flexibility because you get to have fine-grained control over an entire virtual computer, but it has all the pitfalls of a whole computer as well. The Operating System has to be maintained, patched, and updated; disks have to be managed, and all manner of operational overhead goes into their care and feeding. Notably, they are also huge because an entire OS has to go on them. So when you start a Virtual Machine, you have to go through the entire boot sequence of a traditional computer.

These are the three problem areas that containers hope to solve; Ease of management, size, and speed to start. There are others, but for simplicity, we will focus on those three as I feel (IMHO) they are the most relevant to business processes. Containers differ from a traditional virtual machine in one significant way. They do not have an actual Operating System. This may come as a surprise to you, even if you might have dabbled with containers before. Containers instead have an abstraction of an operating system that provides hooks into the host operating system using standards and conventions supplied by the container system.

The de facto standard is Docker for all practical purposes, but just for clarity, others do exist. This standardization is where the notion of a container comes from. In shipping, there was no standardization, which made transporting items difficult because you had to figure out how to hold each item on a boat, train, or truck. Containers provided a standard format for transport "you can put whatever you want inside the container so long as it opens this way, can bolt down this way, and are one of these dimensions." this made the logistical process of moving real-world items much more simplified. In this same way, standardizing the way a container interacts with its host OS to delegate the responsibility for executing tasks simplifies management of the most crucial part, the application.

## Hosting Containers with AWS ECS Fargate

Now that we have a better idea of what makes a container different from a virtual machine, how does this solve our three problems?

First, it makes management easier by letting us write build scripts to create a stable, repeatable representation of the host needed to do the body of work needed by the application. Second, since an OS ultimately hosts the container, that OS can enforce company policy and security policies, so at worst, any container can only do at most that much. For example, if the host OS only allows traffic inbound from a specific subnet and port, the container cannot override that as it is ultimately bound by the host OS's networking rules.

This kind of management reliability continues into data management, memory management, and any other policies that need to be enforced. This ultimately creates a great deal of business agility as operations can reliably open the doors to developers knowing that they have some established rails. As for size, without the need for a whole OS, your container images are often only a few MB, vs. many GB. On the topic of speed, since there isn't a complete boot cycle, the container can effectively start up as fast as the hosted application can start.

The difficulty with containers moves further up the abstraction chain (as is the style of such things) than with Virtual Machines. The challenge comes down to networking and managing container images across many resources so that you can treat a set of computing as one homogeneous unit. Fortunately, there are many solutions for this with products like Kubernetes, OpenShift, Mesos, Nomad, and others. But with this, you are ultimately back to having to manage a fleet of computers along with all the management overhead that goes along with it.

This is the sweet spot of AWS Elastic Container Service (ECS) Fargate. Fargate gives you networking abstractions across a virtual network known as a VPC (Virtual Private Cloud). This network abstraction is built right into the heart of AWS and is well vetted for any type of workload, including high-security government workloads. Fargate takes this a step further by abstracting away the machine management. You can set up traditional clusters and manage your machines if you want, but leveraging Fargate simplifies one more part of your process. Ultimately our goal with using cloud vendors in the first place is to let them be good at infrastructure management so we can be good at managing our business.

Time to jump into it and try it out using .NET containers with AWS Fargate!

**What you will need to get started**

What you'll need to continue are the following:

- Basic knowledge of .NET
- [.NET SDK 3.1](https://docs.microsoft.com/en-in/dotnet/core/install/)
- [An AWS account (we'll be using a free tier product)](https://aws.amazon.com/free)
- [Okta CLI](https://cli.okta.com)
- [AWS CLI V2](https://aws.amazon.com/cli/)
- [Docker Desktop for Windows/macOS (Not required if you are on Linux)](https://www.docker.com/get-started)

This tutorial assumes you already have Docker set up and running.

## Build and Dockerize a .NET Chat Application

So what do you want to build? To keep things simple so we can see the value in using something other than standard HTTP protocols, I'll use SignalR to build a very basic chat application.

- Secure: Only logged-in clients should be able to use the chat functionality
- Chat users names must come from their validated identity
- Real-time

To achieve this, I am going to use four technologies:

- Okta for identity management
- .NET to host the application
- SignalR to provide the socket management abstraction
- Vue.js to provide the rendering for the front-end

### Authentication for Your .NET Chat App

Authentication is vital in any application, but doubly so when you need to depend on who someone is. I used to roll all my own security services, but I don't anymore because there are too many threat verticals and too much for me to care to manage. I'd rather delegate that responsibility to another company that can focus solely on those concerns so I can focus entirely on my business. I personally like using Okta for this purpose. I work with customers with many applications across many languages and vendors; Okta makes it really easy to incorporate all of them into one management pipeline to delegate access to those who need it and shut down access across the entire suite of applications if a bad actor gets a set of credentials.

{% include setup/cli.md type="web" loginRedirectUri="http://localhost:5000/authorization-code/callback" %}

Note the **Issuer URL** and **Client ID**. You will need this in the next step.

> **Note**: To test out your chat application, don't forget to manually add a second user to your Okta org to use for that purpose. Log in to your Okta org and navigate to the **Directory** > **People** page. Click the **Add person** button and fill out the form.

### Setup a .NET Core Web Application

Let us create a new ASP.NET Core Web Application using the `dotnet` CLI. Navigate to the location where you want to create the project and run the following command.

```bash
dotnet new webapp -n Okta.Blog.Chat
```

I'm calling the project **Okta.Blog.Chat**, but please feel free to call your application anything you'd like.

Now, set up your Okta application credentials by opening **appsettings.json** and add the following to the JSON object after **AllowedHosts**:

```json
"OktaSettings": {
  "OktaDomain": "{yourOktaDomain}",
  "ClientId": "{yourOktaClientID}",
  "ClientSecret": "{yourOktaClientSecret}"
}
```

> **Note**: You can find the required values from the **.okta.env** file created at the folder where you executed the `okta apps create` command. The value of `{yourOktaDomain}` should be something like `https://dev-123456.okta.com`. Make sure you don't include `-admin` in the value!

Make sure to exclude **appsettings.json** from Git so that you don't accidentally commit your client secret. You can generate a **.gitignore** file by running the command `dotnet new gitignore`.

Now you'll need to add the authentication library. Run the following command inside the **Okta.Blog.Chat** folder.

```bash
dotnet add package Okta.AspNetCore
```

Now modify **Startup.cs** to use the Okta authentication provider.

Modify the method `ConfigureServices(IServiceCollection services)` to look like the code below. I've commented out a line that we will use later for authorization.

```cs
public void ConfigureServices(IServiceCollection services)
{
    var oktaMvcOptions = new OktaMvcOptions()
    {
        OktaDomain = Configuration["OktaSettings:OktaDomain"],
        ClientId = Configuration["OktaSettings:ClientId"],
        ClientSecret = Configuration["OktaSettings:ClientSecret"],
        Scope = new List<string> { "openid", "profile", "email" },
    };

    services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.DefaultSignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = OktaDefaults.MvcAuthenticationScheme;
    })
    .AddCookie()
    .AddOktaMvc(oktaMvcOptions);

    services.AddRazorPages()
    .AddRazorPagesOptions(options =>
    {
        //options.Conventions.AuthorizePage("/Chat");
    });
    services.AddSignalR();
}
```

Make sure to add imports.

```cs
using Microsoft.AspNetCore.Authentication.Cookies;
using Okta.AspNetCore;
using Okta.Blog.Chat.Hubs;
```

This will add the authentication provider, set the page **Chat** as an authorized page, and add SignalR support.

Next, modify the method `Configure(IApplicationBuilder app, IWebHostEnvironment env)` to look like the code below. I've commented out a line that we will use later during our SignalR setup.

```cs
public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    if (env.IsDevelopment())
    {
        app.UseDeveloperExceptionPage();
    }
    else
    {
        app.UseExceptionHandler("/Error");
        // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
        app.UseHsts();
    }

    app.UseHttpsRedirection();
    app.UseStaticFiles();

    app.UseRouting();

    app.UseAuthentication();
    app.UseAuthorization();

    app.UseEndpoints(endpoints =>
    {
        endpoints.MapRazorPages();
        //endpoints.MapHub<ChatHub>("/chathub");
    });
}
```

The key difference here is `app.UseAuthentication();`.

Next, create a new folder called **Hubs** and a new class file in that folder called **ChatHub.cs** this will provide our chat back-end.

```cs
using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace Okta.Blog.Chat.Hubs
{
    public class ChatHub : Hub
    {
        public async Task SendMessage(string message)
        {
            if (this.Context.User.Identity.IsAuthenticated)
                await Clients.All.SendAsync("ReceiveMessage", this.Context.User.Identity.Name, message);
        }
    }
}
```

You'll see in this ChatHub we've made use of the users' authentication status. This way, even if someone knows the back-end is SignalR, we've mitigated their ability to use the system unless explicitly authenticated. Any additional authorization logic could go here as well.

Next, you need to make sure you have the pages you need. In the **Pages** folder, go ahead and delete the page **Privacy.cshtml** and **Privacy.cshtml.cs** and add a new page named **Chat.cshtml** by running the following command from the **Pages** folder.

```bash
dotnet new page -n Chat
```

Edit **Pages/Shared/\_Layout.cshtml** and modify the second nav item from this:

```html
<a class="nav-link text-dark" asp-area="" asp-page="/Privacy">Privacy</a>
```

To this:

```html
<a class="nav-link text-dark" asp-area="" asp-page="/Chat">Chat</a>
```

At this point, if you run the `dotnet run` command or run the application from Visual Studio, you should be able to navigate to the chat page that just has the heading **"Chat"**. Make sure that it runs successfully before moving on to the next step.

### Add Docker Support to Your .NET Chat Application

Before you add the chat functionality, add the Docker support. Add a file named **Dockerfile** to the root **Okta.Blog.Chat** folder with below content in it.

```docker
# build and publish the app
FROM mcr.microsoft.com/dotnet/sdk:3.1-bullseye AS build
WORKDIR /src
## copy csproj and restore as distinct layers
COPY Okta.Blog.Chat.csproj ./
RUN dotnet restore
## copy everything else and publish app
COPY . ./
RUN dotnet publish -c release -o /app --no-restore

# final stage/image
FROM mcr.microsoft.com/dotnet/aspnet:3.1-bullseye-slim AS base
WORKDIR /app
COPY --from=build /app ./
ENTRYPOINT ["dotnet", "Okta.Blog.Chat.dll"]
```

What is going on is we are building and publishing our application first. Next, we copy the build files and call `ENTRYPOINT`, which translates to "run dotnet with our published DLL" - nothing extraordinary, right? The `FROM` keywords are using other built docker files as base images to build our image from, so all the work of installing .NET etc., is already done.

Now add a **.dockerignore** file with the below content so that they are not copied to the final image.

```
**/.dockerignore
**/.git
**/.vscode
**/bin
**/obj
```

If you are using Visual Studio, you'll see you now have the ability to debug right into a running container in your debug toolbar. If you press **F5** or click the play button, you'll run your app in a Docker Container.

{% img blog/dotnet-aws-fargate/11-DebugDocker.PNG alt:"VS Docker debug" width:"800" %}{: .center-image }

If you are not using Visual Studio, run the following command to build and start the container.

```bash
docker build . -t okta-chat
docker run -it --rm -p 5000:80 okta-chat
```

The app should be accessible at `http://localhost:5000/`.

### Authorize Your Chat App

Modify **Setup.cs** and uncomment the following line.

```cs
options.Conventions.AuthorizePage("/Chat");
```

> **Note**: At this point, if you try to authenticate the `/Chat` path using Google Chrome, you'll get an error. This is because we are running the app without TLS and Chrome blocks set-cookie headers with `SameSite=None` when the `Secure` attribute is not present, which will be preset only for HTTPS requests.

Let's make sure our docker container can run with HTTPS.

First, we need to create a certificate. We can use the .NET CLI for creating self-signed certificates for development. Please note that this is only for development purposes and should not be used in production.

Run the following command to create a self-signed certificate. Use the right command based on the OS you are using and use an appropriate password.

```bash
# clean existing certs if any
dotnet dev-certs https --clean
# create a new cert on macOS/Linux
dotnet dev-certs https -ep ${HOME}/.aspnet/https/aspnetapp.pfx -p mypass123
# create a new cert on Windows
dotnet dev-certs https -ep %USERPROFILE%\.aspnet\https\aspnetapp.pfx -p mypass123
# trust the cert
dotnet dev-certs https --trust
```

Now we can run the container with HTTPS using the below command as we will use the certificate we created above and mount it as a volume.

```bash
# macOS/Linux
docker run -it --rm -p 5000:80 -p 5001:443 -e ASPNETCORE_URLS="https://+;http://+" -e ASPNETCORE_HTTPS_PORT=5001 -e ASPNETCORE_Kestrel__Certificates__Default__Password="mypass123" -e ASPNETCORE_Kestrel__Certificates__Default__Path=/https/aspnetapp.pfx -v ${HOME}/.aspnet/https:/https/ okta-chat

# Windows
docker run -it --rm -p 5000:80 -p 5001:443 -e ASPNETCORE_URLS="https://+;http://+" -e ASPNETCORE_HTTPS_PORT=5001 -e ASPNETCORE_Kestrel__Certificates__Default__Password="mypass123" -e ASPNETCORE_Kestrel__Certificates__Default__Path=/https/aspnetapp.pfx -v %USERPROFILE%\.aspnet\https:/https/ okta-chat
```

The app should be accessible at `https://localhost:5001/` now.

In your Okta Developer Portal, go to **Applications** > **Applications** and click the application's name you created using the CLI. Edit the **General Settings** and add URI for **Sign-in redirect URIs** and **Sign-out redirect URIs** as below:

```bash
Sign-in redirect URI = https://localhost:5001/authorization-code/callback
Sign-out redirect URI = https://localhost:5001/
```

Try running the application, and you should see that to open the chat page, you'll be redirected to the Okta Single Sign-On portal and redirected back. You are now successfully authenticated.

### Add Chat Functionality with Vue.js and SignalR

I'll be using Vue for state management since you can take as little or as much as you want. Sometimes it feels like you gotta buy the whole farm just to get a little milk these days when it comes to developing front-end technologies, but I like that with Vue, I can start with a CDN script tag and use it for a single component, a single page, or dive deep with a robust build system on Node. For this exercise, we'll be using a CDN-hosted script.

But first, you need to finish one thing on the back-end.

Since you have created your **ChatHub.cs**, open **Startup.cs** and uncomment the following line

```cs
endpoints.MapHub<ChatHub>("/chathub");
```

Now modify the **Chat.cshtml** file to look like this:

{% raw %}

```html
@page

<div id="chatApp">
  <div class="container">
    <div class="row">
      <div class="col-2">Message</div>
      <div class="col-4">
        <input type="text" v-model="message" id="message" />
        <input type="button" v-on:click.stop.prevent="sendMessage" id="sendButton" value="Send Message" />
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col-12">
      <hr />
    </div>
  </div>
  <div class="row">
    <div class="col-6">
      <ul id="messagesList">
        <li v-for="(item, index) in chatLog" :key="index">{{ item.User }} - {{ item.Message }}</li>
      </ul>
    </div>
  </div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/aspnet-signalr/1.0.27/signalr.min.js"></script>
<script src="https://unpkg.com/vue@3.2.24/dist/vue.global.prod.js"></script>
<script>
  const connection = new signalR.HubConnectionBuilder().withUrl("/chatHub").build();

  const VueChatApp = {
    data() {
      return {
        isConnected: false,
        message: "",
        chatLog: [],
      };
    },
    mounted() {
      connection.on("ReceiveMessage", (user, message) => {
        this.receiveMessage(user, message);
      });
      connection
        .start()
        .then(() => {
          this.isConnected = true;
        })
        .catch((err) => {
          return console.error(err.toString());
        });
    },
    methods: {
      receiveMessage(user, message) {
        this.chatLog.push({
          User: user,
          Message: message,
        });
      },
      sendMessage() {
        connection
          .invoke("SendMessage", this.message)
          .then(() => {
            this.message = "";
          })
          .catch((err) => {
            return console.error(err.toString());
          });
      },
    },
  };

  Vue.createApp(VueChatApp).mount("#chatApp");
</script>
```

{% endraw %}

We use CDN for the SignalR client library, and the connection to the ChatHub uses the endpoint you set earlier:

```js
const connection = new signalR.HubConnectionBuilder().withUrl("/chatHub").build();
```

The state is stored in the data section of our Vue app. There are three properties in use; A flag to let us know if it is connected, the message currently being typed, and a chat log.

```js
data() {
  return {
    isConnected: false,
    message: "",
    chatLog: [],
  }
},
```

Your app has two methods: `receiveMessage` and `sendMessage`.

When `receiveMessage` is called, it just appends an object to the chat log with the user and the message.

When `sendMessage` is called, we use the SignalR connection to invoke "SendMessage" and pass along our message properties. Once the message is sent, we blank it out to fill a new message.

```js
receiveMessage(user, message) {
  this.chatLog.push({
    User: user,
    Message: message,
  });
},
sendMessage() {
  connection
    .invoke("SendMessage", this.message)
    .then(() => {
      this.message = "";
    })
    .catch((err) => {
      return console.error(err.toString());
    });
},
```

When the app is created, a hook is added for "ReceiveMessage" that calls the ViewModel `receiveMessage` method described previously.

Then the connection to the hub is started, and if successful, `isConnected` is set to true.

```js
connection.on("ReceiveMessage", (user, message) => {
  this.receiveMessage(user, message);
});
connection
  .start()
  .then(() => {
    this.isConnected = true;
  })
  .catch((err) => {
    return console.error(err.toString());
  });
```

If you run your application at this point, you'll have a secured chat application running in a container!

## Deploy Your .NET Chat Application to AWS

Now that the chat application is complete, it's time to deploy it. First, we need to build the docker image and deploy it to AWS to be used. AWS has private container repositories via its Elastic Container Registry (ECR) product.

### Create an ECR Repository

First, we need to make one final change to the **Dockerfile** to get TLS working on Fargate.

Add the following two lines to the **Dockerfile** right after the `dotnet publish` command:

```dockerfile
# build and publish the app
...
RUN dotnet publish -c release -o /app --no-restore

ARG CERT_PASSWORD
RUN dotnet dev-certs https -ep /app/aspnetapp.pfx -p ${CERT_PASSWORD}

# final stage/image
...
```

This will create a self-signed development certificate right within the Docker image, which we can use to run the application with TLS on Fargate for demo purposes.

> **Note**: Using these development certificates is not recommended for production use. I'm using it here for simplicity as this is just a demo. For production setup, you should use a certificate signed by a certificate authority. The recommended way to run a production .NET application on ECS would be to use an AWS Application Load Balancer (ALB) to route traffic to a reverse proxy (Nginx) via an HTTPS listener configured to use a certificate signed by a certificate authority. The reverse proxy would then route traffic to the application. The reverse proxy and the application should also be configured to use TLS using valid certificates.

Login to your AWS console and navigate to ECR.

Click **Create Repository**.

For visibility settings, choose **Private** and name your repository. In my case, I'm going with _okta-chat_. Then click **Create Repository** at the bottom of the wizard.

{% img blog/dotnet-aws-fargate/16-reponaming.png alt:"AWS Create repo" width:"800" %}{: .center-image }

Navigate to **okta-chat** and click **View push commands** this has all the steps you'll need to build and push your image to ECR.

{% img blog/dotnet-aws-fargate/17-PushCommands.png alt:"Push commands" width:"800" %}{: .center-image }

Follow the steps and push the images to ECR. Make sure to pass `--build-arg CERT_PASSWORD=mypass123` to the `docker build` command like below.

```bash
docker build --build-arg CERT_PASSWORD=mypass123 -t okta-chat .
```

Select the copy button in the URI column next to your image and save that for later. This is the path to your image.

{% img blog/dotnet-aws-fargate/18-oktaChatRepo.png alt:"AWS save URI" width:"800" %}{: .center-image }

### Set up the ECS Fargate Cluster

Now set up your ECS cluster.

On the left menu, click **Clusters** under **Amazon ECS**, then click the **Create Cluster** button.

Click **Networking Only** > **Next step**from the options.

{% img blog/dotnet-aws-fargate/19-NetworkOnly.PNG alt:"AWS Networking Only" width:"800" %}{: .center-image }

I named my cluster "okta-test", name yours as you see fit, and click **Create** on the following screen click **View Cluster**.

Now that the cluster is set-up you'll need to create a task for your image to run as.

Click **Task Definitions** on the left menu and click **Create new Task Definition**.

For launch type, select **FARGATE** and click **Next step**.

{% img blog/dotnet-aws-fargate/20-LaunchType.PNG alt:"Fargate launch type" width:"800" %}{: .center-image }

For the **Task Definition Name**, I named mine **okta-chat**.

Set the **Task memory (GB)** to 0.5 GB.
Set the **Task CPU** to 0.25 vCPU.

.NET Core applications are very efficient, as are containers. For many applications, you'll find you can serve many requests with smaller boxes than you might typically be accustomed to.

{% img blog/dotnet-aws-fargate/21-TaskSize.PNG alt:"Task size" width:"800" %}{: .center-image }

Leave other options unchanged.

Now you need to define the image you want to use. Click **Add Container**.

I'll name the container the same thing **okta-chat**.

For the **Image**, you'll need the path you copied from the ECR repository earlier.

Set the soft limit to 512, and add ports 80 and 443.

{% img blog/dotnet-aws-fargate/22-AddContainer.PNG alt:"Add container ports" width:"800" %}{: .center-image }

Scroll down to the **ENVIRONMENT** section and add the following key-value pairs:

```bash
ASPNETCORE_URLS="https://+;http://+"
ASPNETCORE_HTTPS_PORT=443
ASPNETCORE_Kestrel__Certificates__Default__Password="mypass123"
ASPNETCORE_Kestrel__Certificates__Default__Path=./aspnetapp.pfx
```

{% img blog/dotnet-aws-fargate/27-add-env-vars.png alt:"Run new task" width:"800" %}{: .center-image }

Click **Add** at the bottom of the popup. Now click **Create** at the bottom of the page. Go back to your cluster, click on the **Tasks** tab, and click **Run new Task**.

> **Note**: It is recommended to create services instead of tasks for production so that you take full advantage of the elastic scaling capabilities of ECS. I'm using tasks directly for the simplicity of the demo. Using services is also required when using an ALB to route traffic to the application.

{% img blog/dotnet-aws-fargate/23-RunNewTask.PNG alt:"Run new task" width:"800" %}{: .center-image }

Select **FARGATE** as **Launch type**.

Select your default VPC and Subnets under **VPC and security groups**

{% img blog/dotnet-aws-fargate/24-TaskSettings.png alt:"Task settings" width:"800" %}{: .center-image }

Click the **Edit** button next to the **security groups**. Click on **Add rule** to add a new inbound rule for HTTPS port 443. Click **Save** on the popup.

{% img blog/dotnet-aws-fargate/28-security-group.png alt:"Task settings" width:"800" %}{: .center-image }

Now, click **Run Task**.

You'll be taken back to your cluster. Select the Task you created by clicking its ID. Make a note of its public IP; you'll need that to adjust your Okta application settings.

{% img blog/dotnet-aws-fargate/25-RunningTask.png alt:"Running task" width:"800" %}{: .center-image }

In your Okta Developer Portal, go to **Applications** > **Applications** and click the application's name you created using the CLI. Edit the **General Settings** and add URI for **Sign-in redirect URIs** and **Sign-out redirect URIs** using the IP address from your running Task as shown below:

{% img blog/dotnet-aws-fargate/26-update-okta.png alt:"Update Okta" width:"800" %}{: .center-image }

Now, if you navigate to `https://YOUR_FARGET_TASK_PUBLIC_IP`, you'll see you are now the proud owner of a fully functional chat application, secured with Okta, running in an ECS Fargate container.

## Recap

Whew, that was a ride! Good job on making your new chat application. What can we take away from this?

- Serverless is good for HTTP request/response, but other protocols need something different
- Containers are more lightweight than Virtual Machines but come with their own challenges
- A Docker file is just the instructions to build your application, what ports to expose, and launch it
- Fargate makes the hosting of containers easier since you don't have to manage the host machine infrastructure.
- SignalR makes real-time communication easier by abstracting most of the heavy lifting
- Vue can be used for state management without taking on additional build and development pipeline
- Okta makes securing any type of .NET web application easy
- There is no reason to have an insecure site!
- Use AWS ALB + Nginx configured to use TLS with valid certificates in production

Check the code out on GitHub [here](https://github.com/oktadeveloper/okta-dotnetcore-aws-fargate-example).

## Learn More about AWS, .NET, and Authentication

If you are interested in learning more about security and .NET check out these other great articles:

- [The Most Exciting Promise of .NET 5](/blog/2020/04/17/most-exciting-promise-dotnet-5)
- [ASP.NET Core 3.0 MVC Secure Authentication](/blog/2019/11/15/aspnet-core-3-mvc-secure-authentication)
- [5 Minute Serverless Functions Without an IDE](/blog/2019/08/27/five-minutes-serverless-functions-azure)
- [Create Login and Registration in Your ASP.NET Core App](/blog/2019/02/05/login-registration-aspnet-core-mvc)
- [Build Secure Microservices with AWS Lambda and ASP.NET Core](/blog/2019/03/21/build-secure-microservices-with-aspnet-core)
- [Build a CRUD App with ASP.NET Core and Typescript](/blog/2019/03/26/build-a-crud-app-with-aspnetcore-and-typescript)
- [Build a GraphQL API with ASP.NET Core](/blog/2019/04/16/graphql-api-with-aspnetcore)
- [Maintaining Transport Layer Security all the way to your container](https://aws.amazon.com/blogs/compute/maintaining-transport-layer-security-all-the-way-to-your-container-part-2-using-aws-certificate-manager-private-certificate-authority/)

Want to be notified when we publish more awesome developer content? Follow [@oktadev on Twitter](https://twitter.com/oktadev), subscribe to our [YouTube channel](https://youtube.com/c/oktadev), or follow us on [LinkedIn](https://www.linkedin.com/company/oktadev/). If you have a question, please leave a comment below!
