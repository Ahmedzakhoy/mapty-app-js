"use strict";
//selections
const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");
const deleteAllBtn = document.querySelector(".delete-all-btn");
const sortWorkoutsList = document.querySelector("#sort");

//workout parent class
class Workout {
  date = new Date();
  id = Date.now() + ""; // timestamp as ID

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in Km
    this.duration = duration; // in min
  }

  //set description private method
  _setDescription() {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

//running child class
class Running extends Workout {
  type = "running";

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  //calculate pace method
  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

//cycling child class
class Cycling extends Workout {
  type = "cycling";

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  //calculate speed method
  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// APPLICATION ARCHITECTURE
class App {
  //public and private feilds
  #map;
  #mapEvent;
  #workouts = [];
  sortBy = "time-created";
  isBeingEditedId = false;
  editedWorkoutData = {};
  lat;
  lng;

  ///// constructor
  constructor() {
    //get user's position
    this._getPosition();
    //load data from lacal storage
    this._getLocalStorage();
    //event handlers
    inputType.addEventListener("change", this._toggleElevationField);
    sortWorkoutsList.addEventListener("change", this.sortByMethod.bind(this));
    deleteAllBtn.addEventListener("click", this.reset);
    containerWorkouts.addEventListener(
      "click",
      this.startEditingWorkout.bind(this)
    );
    form.addEventListener("change", this.formChangeListener.bind(this));
    form.addEventListener("submit", this.updateWorkoutMethod.bind(this));
    containerWorkouts.addEventListener("click", this._moveToPopup.bind(this));
    containerWorkouts.addEventListener("click", this._deleteWorkout.bind(this));
    form.addEventListener("submit", this._newWorkout.bind(this));
  }

  //_getLocalStorage private method
  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem("workouts"));
    const sort = localStorage.getItem("sort")
      ? localStorage.getItem("sort")
      : "time-created";

    //dont execute if no data available
    if (!data) return;

    //setting #workouts variable and sortBy variable
    this.#workouts = data;
    this.sortBy = sort;

    //changing sort list value on view
    sortWorkoutsList
      .querySelector(`option[value="${this.sortBy}"]`)
      ?.setAttribute("selected", "");

    //doing sort by method without event
    this.sortByMethod();

    //rederning all workouts
    this.#workouts.forEach((workout) => {
      this._renderWorkout(workout);
    });
  }

  //_setLocalStorage private method
  _setLocalStorage() {
    localStorage.setItem("workouts", JSON.stringify(this.#workouts));
    localStorage.setItem("sort", this.sortBy);
  }

  //load map private method
  _loadMap(position) {
    //get coordinates
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];
    //load Map
    this.#map = L.map("map").setView(coords, 11.5);
    //adding tile layers to the map
    L.tileLayer("http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
      maxZoom: 20,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
    }).addTo(this.#map);
    //handling clicks on map
    this.#map.on("click", this._mapEventHandler.bind(this));
    //rendering the markers on map after it is loaded
    this.#workouts.forEach((work) => {
      this._renderWorkoutMarker(work);
    });
  }

  //get position private method
  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () => {
        alert("could not get your position");
      });
    }
  }

  //   show form private method
  _mapEventHandler(mapE) {
    //setting map event variable
    this.#mapEvent = mapE;
    //if being edited is true, don't execute the map event handler
    if (this.isBeingEditedId) return;
    //show form to add new workout after map clicking event
    this._showForm();
  }

  //_renderWorkoutMarker private method
  _renderWorkoutMarker(workout) {
    // display the marker and store it in layer variable
    this.layer = L.marker(workout.coords, {
      riseOnHover: true,
    })
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.description}`
      )
      .openPopup();
  }

  //_removeWorkoutMarker private method
  _removeWorkoutMarker(workout) {
    // remove the marker
    Object.values(this.#map._layers)
      .filter((layer) => (layer._latlng ? true : false))
      .filter(
        (layer) =>
          layer._latlng.lat === workout.coords[0] &&
          layer._latlng.lng === workout.coords[1]
      )
      .forEach((layer) => layer.remove());
  }

  //_moveToPopup view on map private method
  _moveToPopup(event) {
    //workout element specific
    const workoutEl = event.target.closest(".workout");
    if (!workoutEl) return;
    //dont execute if pressing on delete and edit workout buttons
    if (event.target.closest(".delete-workout")) return;
    if (event.target.closest(".edit-workout")) return;

    //find workout by id
    const workout = this.#workouts.find(
      (work) => work.id === workoutEl.dataset.id
    );

    //setting view on map
    this.#map.setView(workout.coords, 15, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  //   show form private method
  _showForm() {
    this._hideAndResetForm();
    form.classList.remove("hidden");
    inputDistance.focus();
  }

  //   hide form private method
  _hideAndResetForm() {
    inputCadence.value =
      inputDistance.value =
      inputDuration.value =
      inputElevation.value =
        "";
    inputType.value = "running";
    this._showCadenceField();
    form.style.display = "none";
    form.classList.add("hidden");
    inputDistance.blur();
    form.style.display = "grid";
  }

  // toggle field private method
  _toggleElevationField() {
    inputElevation.closest(".form__row").classList.toggle("form__row--hidden");
    inputCadence.closest(".form__row").classList.toggle("form__row--hidden");
  }

  // show elevation gain field private method
  _showElevationField() {
    inputElevation.closest(".form__row").classList.remove("form__row--hidden");
    inputCadence.closest(".form__row").classList.add("form__row--hidden");
  }

  // show cadence field private method
  _showCadenceField() {
    inputElevation.closest(".form__row").classList.add("form__row--hidden");
    inputCadence.closest(".form__row").classList.remove("form__row--hidden");
  }

  //validate data method
  validateDataMethod(...inputs) {
    const validInputs = inputs.every((inp) => Number.isFinite(inp));
    const allPositive = inputs.every((inp) => inp > 0);
    return validInputs && allPositive;
  }

  //sorting method logic
  sortByMethod(event) {
    //setting sort by variable
    this.sortBy = event ? event.target.value : "time-created";
    //saving sortby variable to local storage
    localStorage.setItem("sort", this.sortBy);
    //sorting logic according to type
    if (this.sortBy === "time-created") {
      this.#workouts.sort((a, b) => +a.id - +b.id);
    }
    if (this.sortBy === "distance") {
      this.#workouts.sort((a, b) => a.distance - b.distance);
    }
    if (this.sortBy === "duration") {
      this.#workouts.sort((a, b) => a.duration - b.duration);
    }
    //dont delete and re-render if called without event from Load data method
    if (!event) return;
    //remove all workout elements
    containerWorkouts
      .querySelectorAll(".workout")
      .forEach((element) => element.remove());
    //rendering workouts again after sorting them
    this.#workouts.forEach((workout) => this._renderWorkout(workout));
  }

  //start edtiting event listener
  startEditingWorkout(event) {
    //making event specific to edit button
    const editBtn = event.target.closest(".edit-workout");
    if (!editBtn) return;

    //if is being edited stop implementing edit event button until done
    if (!!this.isBeingEditedId) return;

    //workout details
    const workoutElement = editBtn.closest(".workout");
    const workoutId = workoutElement.dataset.id;
    const workoutIndex = this.#workouts.findIndex(
      (workout) => workout.id === workoutId
    );

    //setting is being edited to the id of the workout
    this.isBeingEditedId = workoutId;
    //getting data from #workouts array using the index
    let workoutData = this.#workouts[workoutIndex];
    //storing edited workout data
    this.editedWorkoutData = { ...workoutData };

    //show from and populate data
    this._showForm();
    inputType.value = workoutData.type;
    inputDistance.value = workoutData.distance;
    inputDuration.value = workoutData.duration;
    if (workoutData.type === "running") {
      inputCadence.value = workoutData.cadence;
      this._showCadenceField();
    }
    if (workoutData.type === "cycling") {
      inputElevation.value = workoutData.elevationGain;
      this._showElevationField();
    }

    //remove the element being edited
    workoutElement.remove();
    //setting map event to false so that we enter editing mode and leave adding new workout mode
    this.#mapEvent = false;
  }

  //change workout data being edited on change in the form event listener
  formChangeListener() {
    //if no editing mode, this will not execute
    if (!this.isBeingEditedId) return;

    //getting data from fields
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const cadence = +inputCadence.value;
    const elevationGain = +inputElevation.value;

    //updating edited workout data variable by overriding existend key value pairs
    this.editedWorkoutData = {
      ...this.editedWorkoutData,
      type,
      distance,
      duration,
      cadence,
      elevationGain,
    };
  }

  //updating data in #workouta array event listener to submit form event
  updateWorkoutMethod(event) {
    event.preventDefault();

    //if map event so adding new workout and not editing existing one so this will not execute
    if (this.#mapEvent) return;

    //validate data with mutual values between running and cycling types
    let validData = this.validateDataMethod(
      this.editedWorkoutData.distance,
      this.editedWorkoutData.duration
    );

    //if type is running
    if (this.editedWorkoutData.type === "running") {
      //update valide data with the running specific component
      validData =
        validData && this.validateDataMethod(this.editedWorkoutData.cadence);
      //update other type specific data
      this.editedWorkoutData = {
        ...this.editedWorkoutData,
        elevationGain: false,
        speed: false,
        description: this.editedWorkoutData.description.replace(
          "Cycling",
          "Running"
        ),
        pace: this.editedWorkoutData.duration / this.editedWorkoutData.distance,
      };
    }

    //if type is cycling
    if (this.editedWorkoutData.type === "cycling") {
      //update valide data with the running specific component
      validData =
        validData &&
        this.validateDataMethod(this.editedWorkoutData.elevationGain);
      //update other type specific data
      this.editedWorkoutData = {
        ...this.editedWorkoutData,
        cadence: false,
        pace: false,
        description: this.editedWorkoutData.description.replace(
          "Running",
          "Cycling"
        ),
        speed:
          this.editedWorkoutData.distance /
          (this.editedWorkoutData.duration / 60),
      };
    }

    //alert if valid data is not true
    if (!validData) {
      return alert("inputs have to be positive numbers!");
    }

    //find index of edited workout from id
    const workoutIndex = this.#workouts.findIndex(
      (workout) => workout.id === this.editedWorkoutData.id
    );

    //mutate the array with splice and adding new data
    this.#workouts.splice(workoutIndex, 1, this.editedWorkoutData);
    //render workout on list
    this._renderWorkout(this.#workouts[workoutIndex]);
    //remove workout marker from map
    this._removeWorkoutMarker(this.#workouts[workoutIndex]);
    //render workout new marker on map
    this._renderWorkoutMarker(this.#workouts[workoutIndex]);
    //hide form and clear inputs
    this._hideAndResetForm();
    //set local storage to all workouts
    this._setLocalStorage();
    //changing editing state to false after finishing editing
    this.isBeingEditedId = false;
  }

  //new workout private method
  _newWorkout(event) {
    event.preventDefault();
    //if no map event, dont implement this method
    if (!this.#mapEvent) return;
    //get data from the form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    let workout;
    const { lat, lng } = this.#mapEvent.latlng;

    //if workout is running, create running object
    if (type === "running") {
      const cadence = +inputCadence.value;
      //check if data is valid
      if (!this.validateDataMethod(distance, duration, cadence))
        return alert("inputs have to be positive numbers!");

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    //if workout is cycling, create cycling object
    if (type === "cycling") {
      const elevation = +inputElevation.value;
      if (!this.validateDataMethod(distance, duration, elevation))
        return alert("inputs have to be positive numbers!");

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    //add new object to workout array
    this.#workouts.push(workout);
    //render workout on map
    this._renderWorkoutMarker(workout);
    //render workout on list
    this._renderWorkout(workout);
    //hide form and clear inputs
    this._hideAndResetForm();
    //set local storage to all workouts
    this._setLocalStorage();
  }

  //_renderWorkout private method
  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <h2 class="workout__title">${workout.description}</h2>
          <h2 class="delete-workout">✖</h2>
          <h2 class="edit-workout">edit</h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
    `;

    //type specific code for running
    if (workout.type === "running") {
      html += `
      <div class="workout__details">
      <span class="workout__icon">⚡️</span>
      <span class="workout__value">${workout.pace.toFixed(1)}</span>
      <span class="workout__unit">min/km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">🦶🏼</span>
      <span class="workout__value">${workout.cadence}</span>
      <span class="workout__unit">spm</span>
    </div>
  </li>
      `;
    }

    //type specific code for cycling
    if (workout.type === "cycling") {
      html += `
      <div class="workout__details">
      <span class="workout__icon">⚡️</span>
      <span class="workout__value">${workout.speed.toFixed(1)}</span>
      <span class="workout__unit">km/h</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⛰</span>
      <span class="workout__value">${workout.elevationGain}</span>
      <span class="workout__unit">m</span>
    </div>
  </li>
    `;
    }

    //redering
    form.insertAdjacentHTML("afterend", html);
  }

  //delete workout method
  _deleteWorkout(event) {
    const deleteBtn = event.target.closest(".delete-workout");
    //fire only on delete button
    if (!deleteBtn) return;

    //find workout index
    const workout = deleteBtn.closest(".workout");
    const workoutId = workout.dataset.id;
    const workoutIndex = this.#workouts.findIndex(
      (workout) => workout.id === workoutId
    );

    //remove workout marker on map
    this._removeWorkoutMarker(this.#workouts[workoutIndex]);
    //remove workout from workout data array
    this.#workouts.splice(workoutIndex, 1);
    //remove workout element
    workout.remove();
    //set local storage to all workouts
    this._setLocalStorage();
  }
  //reset public method
  reset() {
    //dont execute if didnt confirm the action
    if (!confirm("are you sure you want to reset the App ?")) return;

    ///delete all data and relod
    localStorage.removeItem("workouts");
    localStorage.removeItem("sort");
    location.reload();
  }
}

//exeuting App main functionality
const app = new App();

// additional features implemented by Ahmed Mustafa
//delete single workout
//delete all workouts and data
//edit workout
//sort by time-created, distance, duration
//design made responsive

//hard features to implement in the future -->
//ability to draw lines and shapes instead of points on map
//geocode location from cooardinates("run in faro, portugal")
//display weather from workout time and place
