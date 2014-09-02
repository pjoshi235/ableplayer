(function () {
  // Loads files referenced in track elements, and performs appropriate setup.
  // For example, captions and text descriptions.
  // This will be called whenever the player is recreated.
  AblePlayer.prototype.setupTracks = function() {
    var deferred = new $.Deferred();
    var promise = deferred.promise();
    this.$tracks = this.$media.find('track');

    this.captions = [];
    this.descriptions = [];

    var loadingPromises = [];
    for (var ii = 0; ii < this.$tracks.length; ii++) {
      var track = this.$tracks[ii];
      var kind = track.getAttribute('kind');
      var trackSrc = track.getAttribute('src');

      if (!trackSrc) {
        // Nothing to load!
        continue;
      }

      var loadingPromise = this.loadTextObject(trackSrc);
      var thisObj = this;
      loadingPromises.push(loadingPromise);
      loadingPromise.then((function (track, kind) {
        return function (trackText) {
          var cues = thisObj.parseWebVTT(trackText).cues;
          if (kind === 'captions' || kind === 'subtitles') {
            thisObj.setupCaptions(track, cues);
          }
          else if (kind === 'descriptions') {
            thisObj.setupDescriptions(track, cues);
          }
          else if (kind === 'chapters') {
            thisObj.setupChapters(track, cues);
          }
          else if (kind === 'metadata') {
            thisObj.setupMetadata(track, cues);
          }
        }
      })(track, kind));
    }

    $.when.apply($, loadingPromises).then(function () {
      deferred.resolve();
    });

    return promise;
  };

  AblePlayer.prototype.setupCaptions = function (track, cues) {
    var trackLang = track.getAttribute('srclang');
    var trackLabel = track.getAttribute('label') || trackLang;
    this.hasCaptions = true;

    // create a div for displaying captions  
    // includes aria-hidden="true" because otherwise 
    // captions being added and removed causes sporadic changes to focus in JAWS
    // (not a problem in NVDA or VoiceOver)
    if (!this.$captionDiv) {
      this.$captionDiv = $('<div>',{
        'class': 'able-captions',
        'aria-hidden': 'true' 
      });
      this.$vidcapContainer.append(this.$captionDiv);
    }

    this.currentCaption = -1;
    if (this.prefCaptions === 1) { 
      // Captions default to on.
      this.captionsOn = true; 
    }
    else { 
      this.captionsOn = false;
    }
    
    this.captions.push({
      cues: cues,
      language: trackLang,
      label: trackLabel
    });
      
    // TODO: Apply this sorting to captions as well.
    if (trackLang && this.includeTranscript) {
      // TODO: Move the refresh of the transcript select box to a central location?
      this.$transcriptLanguageSelectContainer.show();
      var option = $('<option value="' + trackLang + '">' + trackLabel + '</option>');
      // TODO: This is a terrible hack, but I can't find a better way to detect whether we have a default track already entered in the list...
      if ($(track).attr('default') !== undefined) {
        option.attr('selected', 'selected');
        this.$transcriptLanguageSelect.prepend(option);
        this.defaultTrackInsertedToTranscript = 1;
      }
      else {
        var options = this.$transcriptLanguageSelect.find('option');
        // Alphabetically among non-default languages.
        if (options.length === 0) {
          this.$transcriptLanguageSelect.append(option);
        }
        else {
          var inserted = false;
          // this.defaultTrackInserted is 1 if and only if a default track is already in the select.
          for (var ii = this.defaultTrackInserted || 0; ii < options.length; ii++) {
            if (trackLabel.toLowerCase() < options.eq(ii).text().toLowerCase()) {
              option.insertBefore(options.eq(ii));
              inserted = true;
              break;
            }
          }
          if (!inserted) {
            this.$transcriptLanguageSelect.append(option);
          }
        }
      }

      if (this.$transcriptLanguageSelect.find('option').length > 1) {
        // More than one option now, so enable the select.
        this.$transcriptLanguageSelect.prop('disabled', false);
      }
    }
  };

  AblePlayer.prototype.setupDescriptions = function (track, cues) {
    var trackLang = track.getAttribute('srclang');

    // prepare closed description, even if user doesn't prefer it 
    // this way it's available if needed 
    this.hasClosedDesc = true;
    // Display the description div.
    //this.$descDiv.show();
    this.currentDescription = -1;
    if ((this.prefDesc === 1) && (this.prefClosedDesc === 1)) { 
      this.descOn = true;
    }

    this.descriptions.push({
      cues: cues,
      language: trackLang
    });
  };

  AblePlayer.prototype.setupChapters = function (track, cues) {
    // NOTE: WebVTT supports nested timestamps (to form an outline) 
    // This is not currently supported.
    this.hasChapters = true;
    this.chapters = cues;
  };

  AblePlayer.prototype.setupMetadata = function(track, cues) {
    this.metadata = cues;
  }
      
  AblePlayer.prototype.loadTextObject = function(src) {
    var deferred = new $.Deferred();
    var promise = deferred.promise();
    var thisObj = this; 

    // create a temp div for holding data
    var $tempDiv = $('<div>',{ 
      style: 'display:none'
    });

    $tempDiv.load(src, function (trackText, status, req) { 
      if (status === 'error') { 
        if (thisObj.debug) {
          console.log ('error reading file ' + src + ': ' + status);
        }
        deferred.fail();
      }
      else {
        deferred.resolve(trackText);
      }
      $tempDiv.remove();
    });

    return promise;
  };
})();
