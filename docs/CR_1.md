Business Requirements

1. Ppropose a database schema for the Kanban, saving it as JSON. Document the database approach in docs/ and get user sign off.
2. mplement authentication process so that user has signup , signing, forget password feature. Signup process must be validated through email where after getting the OTP in email, user has a screen of password change for the first time. User will login to the system with the preferred username and password where username will be asked to input in the Signup process. Forget password also be validated and verified with email. 
3. Make the login page slick and enterprise envy style. Since this application mainly for my 8 Years old boy Shreehan, you should user attractive animation and amazing color/fonts-style.
4. After login , user will land in the current home homepage. 
5. Now add API routes to allow the backend to read and test this thoroughly with backend unit tests. The database should be created if it doesn't exist.
6. Now have the frontend actually use the backend API, so that the app is a proper persistent of any changes. Test very throughly.



Special Attention: 
* Python FastAPI backend, including serving the static NextJS site at /
* Everything packaged into a Docker container
* Use "uv" as the package manager for python in the Docker container
* Use OpenRouter for the AI calls. An OPENROUTER_API_KEY is in .env in the project root
* Use openai/gpt-oss-120b as the model
* Use SQLLite local database for the database, creating a new db if it doesn't exist
* Start and Stop server scripts for Mac, PC, Linux in scripts/